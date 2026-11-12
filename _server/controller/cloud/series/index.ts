import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import { isAdmin } from "@module/Permission";
import toPublicUser from "@module/PublicUser";
import {
  DESCRIPTION_MAX,
  SeriesModel,
  TITLE_MAX,
  areOwnVisiblePosts,
  visiblePosts,
} from "@module/Series";
import { caller, callerId, fail, pathId, sendError } from "../admin/_shared";
import { boundedString, idList, objectBody } from "../_body";
import { toPostListItems } from "../post/_listItems";

const PostDB = new MongoDB.Post();
const UserDB = new MongoDB.User();

const FIELDS = ["title", "description", "posts"] as const;

// The series as create and edit return it (post ids as stored).
function toSeries(series: any) {
  return {
    _id: String(series._id),
    user: series.user,
    title: series.title ?? "",
    description: series.description ?? "",
    posts: series.posts ?? [],
    createdAt: series.createdAt ?? null,
    updatedAt: series.updatedAt ?? null,
  };
}

/**
 * The validated fields of a create or edit body. `posts` must be distinct
 * non-removed posts written by `owner`.
 */
async function seriesFields(body: Record<string, unknown>, owner: string) {
  const fields: Record<string, unknown> = {};
  if (body.title !== undefined)
    fields.title = boundedString(body.title, "title", TITLE_MAX, {
      trim: true,
      min: 1,
    });
  if (body.description !== undefined)
    fields.description = boundedString(
      body.description,
      "description",
      DESCRIPTION_MAX,
      { trim: true },
    );
  if (body.posts !== undefined) {
    const posts = idList(body.posts, "posts");
    if (!(await areOwnVisiblePosts(owner, posts)))
      fail(
        CustomStatus.INVALID_BODY,
        "posts must be your own posts that are not removed",
      );
    fields.posts = posts;
  }
  return fields;
}

// A non-removed series, or 404/4000.
async function readSeries(id: string) {
  const series = await SeriesModel.findOne({ _id: id, removed: false }).lean();
  if (!series) fail(CustomStatus.NOT_FOUND, "Series not found");
  return series as any;
}

// POST /series { title, description?, posts? } (JWT)
export const create: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req, FIELDS, { required: ["title"] });
    const owner = callerId(req);
    const fields = await seriesFields(body, owner);

    const series = await SeriesModel.create({ ...fields, user: owner });

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toSeries(series.toObject()) });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /series/:id { title?, description?, posts? } (the owner). `posts`
// replaces the whole ordered list, which is also how posts are reordered.
export const edit: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const body = objectBody(req, FIELDS, { nonEmpty: true });
    const series = await readSeries(id);
    if (series.user !== callerId(req))
      fail(CustomStatus.FORBIDDEN, "Only the owner can edit a series");

    const fields = await seriesFields(body, series.user);
    const updated = await SeriesModel.findOneAndUpdate(
      { _id: id, removed: false },
      { $set: fields },
      { returnDocument: "after" },
    ).lean();
    if (!updated) fail(CustomStatus.NOT_FOUND, "Series not found");

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toSeries(updated) });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /series/:id (the owner or an admin; soft remove)
export const remove: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const actor = callerId(req);
    const series = await readSeries(id);
    const isOwner = series.user === actor;
    if (!isOwner && !isAdmin(caller(req)))
      fail(CustomStatus.FORBIDDEN, "Only the owner or an admin can delete it");

    const removed = await SeriesModel.findOneAndUpdate(
      { _id: id, removed: false },
      { $set: { removed: true } },
      { returnDocument: "after", projection: { _id: 1 } },
    ).lean();
    if (!removed) fail(CustomStatus.NOT_FOUND, "Series not found");

    if (!isOwner) {
      await recordAudit({
        actor,
        action: "series.remove",
        target: { kind: "series", id, label: series.title ?? "" },
        meta: { admin: true, user: series.user },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: id, removed: true },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * GET /series/:id (public): the series with the owner's public fields and
 * its non-removed posts as post list items, in series order.
 */
export const read: RequestHandler = async (req, res) => {
  try {
    const series = await readSeries(pathId(req));
    const ids: string[] = series.posts ?? [];

    const [owner, posts] = await Promise.all([
      UserDB.read({ id: series.user }).catch(() => null),
      ids.length
        ? PostDB.list({ _id: { $in: ids }, removed: false })
        : Promise.resolve([]),
    ]);
    const byId = new Map(posts.map((post) => [String(post._id), post]));
    const ordered = ids.flatMap((postId) => {
      const post = byId.get(postId);
      return post ? [post] : [];
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: String(series._id),
        title: series.title ?? "",
        description: series.description ?? "",
        user: owner ? toPublicUser(owner) : { _id: series.user },
        posts: await toPostListItems(ordered),
        createdAt: series.createdAt ?? null,
        updatedAt: series.updatedAt ?? null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * GET /user/:id/series (public): the user's series, newest first. `posts`
 * holds the ids of the non-removed posts in order, `postCount` their number
 * and `cover` the first one's cover ("" when empty).
 */
export const listByUser: RequestHandler = async (req, res) => {
  try {
    const userId = pathId(req);
    const user = await UserDB.read({ id: userId }).catch(() => null);
    if (!user) fail(CustomStatus.NOT_FOUND, "User not found");

    const seriesList: any[] = await SeriesModel.find({
      user: String(user._id),
      removed: false,
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    const posts = await visiblePosts(
      seriesList.flatMap((series) => series.posts ?? []),
      { cover: 1 },
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: seriesList.map((series) => {
        const ids = (series.posts ?? []).filter((id: string) => posts.has(id));
        return {
          _id: String(series._id),
          title: series.title ?? "",
          description: series.description ?? "",
          posts: ids,
          postCount: ids.length,
          cover: ids.length ? (posts.get(ids[0])?.cover ?? "") : "",
          createdAt: series.createdAt ?? null,
          updatedAt: series.updatedAt ?? null,
        };
      }),
      total: seriesList.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
