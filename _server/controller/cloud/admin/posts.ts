import { RequestHandler } from "express";
import { SortOrder, isValidObjectId } from "mongoose";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { AuditAction, recordAudit } from "@module/Audit";
import {
  callerId,
  containsPattern,
  exactBody,
  fail,
  pagination,
  pathId,
  queryEnum,
  queryId,
  queryText,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();
const CommentDB = new MongoDB.Comment();

const STATUSES = ["active", "removed", "pinned", "all"] as const;
const SORTS = ["newest", "oldest", "likes"] as const;
const SORT_ORDERS: Record<(typeof SORTS)[number], Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  likes: { likes: -1, createdAt: -1, _id: -1 },
};

const MAX_BATCH = 100;

// GET /admin/posts (admin)
export const listPosts: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const q = queryText(req);
    const sig = queryId(req, "sig");
    const status = queryEnum(req, "status", STATUSES, "active");
    const sort = queryEnum(req, "sort", SORTS, "newest");

    const filter: Filter = {};
    if (status === "active") filter.removed = false;
    if (status === "removed") filter.removed = true;
    if (status === "pinned")
      Object.assign(filter, { removed: false, pinned: true });
    if (sig) filter.sig = sig;
    if (q) {
      const pattern = containsPattern(q);
      const authorIds = await AdminDB.userIdsMatching(pattern);
      filter.$or = [{ title: pattern }, { user: { $in: authorIds } }];
    }

    const { data, total } = await AdminDB.listPosts(filter, {
      skip,
      limit,
      sort: SORT_ORDERS[sort],
    });

    const [authors, comments] = await Promise.all([
      AdminDB.usersByIds(
        data.map((post) => post.user),
        { name: 1, customId: 1 },
      ),
      CommentDB.countByPost(data.map((post) => String(post._id))),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((post) => {
        const id = String(post._id);
        const author = authors.get(String(post.user));
        return {
          _id: id,
          title: post.title ?? "",
          sig: post.sig ?? "",
          user: {
            _id: post.user ?? "",
            name: author?.name ?? "",
            customId: author?.customId ?? "",
          },
          createdAt: post.createdAt ?? null,
          updatedAt: post.updatedAt ?? null,
          pinned: post.pinned ?? false,
          removed: post.removed ?? false,
          likes: post.likes ?? 0,
          comments: comments[id] ?? 0,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const POST_ACTIONS = ["pin", "unpin", "remove", "restore"] as const;
type PostAction = (typeof POST_ACTIONS)[number];

const ACTIONS: Record<
  PostAction,
  { flag: "pinned" | "removed"; value: boolean; audit: AuditAction }
> = {
  pin: { flag: "pinned", value: true, audit: "post.pin" },
  unpin: { flag: "pinned", value: false, audit: "post.unpin" },
  remove: { flag: "removed", value: true, audit: "post.remove" },
  restore: { flag: "removed", value: false, audit: "post.restore" },
};

/**
 * Applies the action to one post and records it when something changed.
 * Returns the post as it is now, or null when there is no such post.
 */
async function applyAction(
  actor: string,
  id: string,
  action: PostAction,
  meta: Record<string, unknown> = {},
) {
  const { flag, value, audit } = ACTIONS[action];
  const { changed, current } = await AdminDB.setPostFlag(id, flag, value);

  if (changed) {
    await recordAudit({
      actor,
      action: audit,
      target: { kind: "post", id, label: changed.title ?? "" },
      meta: { sig: changed.sig ?? "", ...meta },
    });
  }

  return current
    ? {
        post: {
          _id: String(current._id),
          pinned: current.pinned ?? false,
          removed: current.removed ?? false,
        },
        changed: Boolean(changed),
      }
    : null;
}

function singleAction(action: PostAction | "pinBody"): RequestHandler {
  return async (req, res) => {
    try {
      const id = pathId(req);

      let resolved: PostAction;
      if (action === "pinBody") {
        const { pinned } = exactBody(req, ["pinned"]);
        if (typeof pinned !== "boolean")
          fail(CustomStatus.INVALID_BODY, "pinned must be true or false");
        resolved = pinned ? "pin" : "unpin";
      } else {
        resolved = action;
      }

      const result = await applyAction(callerId(req), id, resolved);
      if (!result) fail(CustomStatus.NOT_FOUND, "Post not found");

      return res
        .status(HttpStatus.OK)
        .json({ status: CustomStatus.OK, data: result.post });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

// POST /admin/posts/:id/pin { pinned } (admin)
export const pinPost = singleAction("pinBody");
// POST /admin/posts/:id/remove (admin)
export const removePost = singleAction("remove");
// POST /admin/posts/:id/restore (admin)
export const restorePost = singleAction("restore");

// POST /admin/posts/batch { ids, action } (admin)
export const batchPosts: RequestHandler = async (req, res) => {
  try {
    const { ids, action } = exactBody(req, ["ids", "action"]);

    if (!POST_ACTIONS.includes(action as PostAction))
      fail(
        CustomStatus.INVALID_BODY,
        "action must be pin, unpin, remove or restore",
      );
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > MAX_BATCH ||
      !ids.every((id) => typeof id === "string" && isValidObjectId(id))
    )
      fail(
        CustomStatus.INVALID_BODY,
        `ids must be 1 to ${MAX_BATCH} valid post ids`,
      );

    const actor = callerId(req);
    const uniqueIds = Array.from(new Set(ids as string[]));
    const results = await Promise.all(
      uniqueIds.map((id) =>
        applyAction(actor, id, action as PostAction, { batch: true }),
      ),
    );
    const updated = results.filter((result) => result?.changed).length;

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: { updated } });
  } catch (error) {
    return sendError(res, error);
  }
};
