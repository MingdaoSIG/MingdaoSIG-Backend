import { Request, RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin } from "@module/Permission";
import PlainTextExcerpt from "@module/PlainTextExcerpt";
import {
  CONTENT_MAX,
  DraftModel,
  MAX_DRAFTS_PER_USER,
  toDraft,
} from "@module/Draft";
import { caller, callerId, fail, pathId, sendError } from "../admin/_shared";
import { objectBody, storedId } from "../_body";

const PostDB = new MongoDB.Post();

const FIELDS = ["title", "sig", "content", "cover", "hashtag", "post"] as const;

// Only the start of the content is needed for the list excerpt.
const EXCERPT_SOURCE_LENGTH = 8000;

function stringField(value: unknown, name: string) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${name} must be a string`);
  return value;
}

/**
 * The validated fields of a create or update body. Everything is optional:
 * a draft may be saved at any point while writing. `post` is null or a
 * post the caller may edit (its author, or an admin).
 */
async function draftFields(req: Request, body: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};

  if (body.title !== undefined) fields.title = stringField(body.title, "title");
  if (body.cover !== undefined) fields.cover = stringField(body.cover, "cover");
  if (body.sig !== undefined)
    fields.sig = body.sig === "" ? "" : storedId(body.sig, "sig");

  if (body.content !== undefined) {
    const content = stringField(body.content, "content");
    if (content.length > CONTENT_MAX)
      fail(
        CustomStatus.INVALID_CONTENT_LENGTH,
        `content must be at most ${CONTENT_MAX} characters`,
      );
    fields.content = content;
  }

  if (body.hashtag !== undefined) {
    if (
      !Array.isArray(body.hashtag) ||
      !body.hashtag.every((tag) => typeof tag === "string")
    )
      fail(CustomStatus.INVALID_BODY, "hashtag must be an array of strings");
    fields.hashtag = body.hashtag;
  }

  if (body.post !== undefined) {
    if (body.post === null) {
      fields.post = null;
    } else {
      const postId = storedId(body.post, "post");
      const post = await PostDB.read(
        { id: postId },
        { lean: true, projection: { user: 1 } },
      ).catch(() => null);
      if (!post || (post.user !== callerId(req) && !isAdmin(caller(req))))
        fail(CustomStatus.INVALID_BODY, "post must be a post you can edit");
      fields.post = postId;
    }
  }

  return fields;
}

// The caller's own draft, or 404/4000 (missing) / 403/4001 (someone else's).
async function ownDraft(req: Request) {
  const draft = await DraftModel.findById(pathId(req)).lean();
  if (!draft) fail(CustomStatus.NOT_FOUND, "Draft not found");
  if ((draft as any).user !== callerId(req))
    fail(CustomStatus.FORBIDDEN, "Not your draft");
  return draft as any;
}

const tooMany = () =>
  fail(
    CustomStatus.CONTENT_SIZE_EXCEEDED,
    `At most ${MAX_DRAFTS_PER_USER} drafts; delete one first`,
  );

/**
 * GET /draft (JWT): the caller's drafts, newest saved first, without
 * `content` but with a plain text `excerpt`.
 */
export const list: RequestHandler = async (req, res) => {
  try {
    const drafts: any[] = await DraftModel.aggregate([
      { $match: { user: callerId(req) } },
      { $sort: { updatedAt: -1, _id: -1 } },
      {
        $project: {
          title: 1,
          sig: 1,
          cover: 1,
          hashtag: 1,
          post: 1,
          createdAt: 1,
          updatedAt: 1,
          start: { $substrCP: ["$content", 0, EXCERPT_SOURCE_LENGTH] },
        },
      },
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: drafts.map((draft) => {
        const { content: _content, user: _user, ...rest } = toDraft(draft);
        return { ...rest, excerpt: PlainTextExcerpt(draft.start) };
      }),
      total: drafts.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /draft/:id (the owner)
export const read: RequestHandler = async (req, res) => {
  try {
    const draft = await ownDraft(req);
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toDraft(draft) });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /draft (JWT). At most 20 per user: 4026 when full.
export const create: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req, FIELDS);
    const fields = await draftFields(req, body);
    const user = callerId(req);

    if ((await DraftModel.countDocuments({ user })) >= MAX_DRAFTS_PER_USER)
      tooMany();

    const draft = await DraftModel.create({ ...fields, user });
    // Two creates at once could both pass the check above.
    if ((await DraftModel.countDocuments({ user })) > MAX_DRAFTS_PER_USER) {
      await DraftModel.deleteOne({ _id: draft._id });
      tooMany();
    }

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toDraft(draft.toObject()) });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /draft/:id (the owner): updates the fields sent.
export const update: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req, FIELDS, { nonEmpty: true });
    const draft = await ownDraft(req);
    const fields = await draftFields(req, body);

    const updated = await DraftModel.findOneAndUpdate(
      { _id: draft._id, user: draft.user },
      { $set: fields },
      { returnDocument: "after" },
    ).lean();
    if (!updated) fail(CustomStatus.NOT_FOUND, "Draft not found");

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toDraft(updated) });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /draft/:id (the owner). Deleted for good.
export const remove: RequestHandler = async (req, res) => {
  try {
    const draft = await ownDraft(req);
    await DraftModel.deleteOne({ _id: draft._id, user: draft.user });
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: String(draft._id) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
