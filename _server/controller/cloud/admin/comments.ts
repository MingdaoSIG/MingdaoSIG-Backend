import { RequestHandler } from "express";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import {
  callerId,
  containsPattern,
  fail,
  pagination,
  pathId,
  queryEnum,
  queryId,
  queryText,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();

const STATUSES = ["active", "removed", "all"] as const;
const LABEL_LENGTH = 100;

// GET /admin/comments (admin)
export const listComments: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const q = queryText(req);
    const post = queryId(req, "post");
    const user = queryId(req, "user");
    const status = queryEnum(req, "status", STATUSES, "active");

    const filter: Filter = {};
    if (status !== "all") filter.removed = status === "removed";
    if (post) filter.post = post;
    if (user) filter.user = user;
    if (q) filter.content = containsPattern(q);

    const { data, total } = await AdminDB.listComments(filter, {
      skip,
      limit,
    });

    const [posts, users] = await Promise.all([
      AdminDB.postsByIds(
        data.map((comment) => comment.post),
        { title: 1 },
      ),
      AdminDB.usersByIds(
        data.map((comment) => comment.user),
        { name: 1, customId: 1 },
      ),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((comment) => {
        const author = users.get(String(comment.user));
        return {
          _id: String(comment._id),
          content: comment.content ?? "",
          post: {
            _id: comment.post ?? "",
            title: posts.get(String(comment.post))?.title ?? "",
          },
          user: {
            _id: comment.user ?? "",
            name: author?.name ?? "",
            customId: author?.customId ?? "",
          },
          reply: comment.reply ?? "",
          createdAt: comment.createdAt ?? null,
          updatedAt: comment.updatedAt ?? null,
          removed: comment.removed ?? false,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

function setRemoved(removed: boolean): RequestHandler {
  return async (req, res) => {
    try {
      const id = pathId(req);

      const { changed, current } = await AdminDB.setCommentRemoved(id, removed);
      if (!current) fail(CustomStatus.NOT_FOUND, "Comment not found");

      if (changed) {
        await recordAudit({
          actor: callerId(req),
          action: removed ? "comment.remove" : "comment.restore",
          target: {
            kind: "comment",
            id,
            label: Array.from(String(changed.content ?? ""))
              .slice(0, LABEL_LENGTH)
              .join(""),
          },
          meta: { post: changed.post ?? "", user: changed.user ?? "" },
        });
      }

      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: { _id: id, removed: current.removed ?? false },
      });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

// POST /admin/comments/:id/remove (admin)
export const removeComment = setRemoved(true);
// POST /admin/comments/:id/restore (admin)
export const restoreComment = setRemoved(false);
