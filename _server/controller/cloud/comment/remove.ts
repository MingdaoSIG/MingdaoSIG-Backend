import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Comment } from "@type/comment";
import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import { isAdmin, isSigManager } from "@module/Permission";
import { sendError } from "./_shared";

const CommentDB = new MongoDB.Comment();
const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();

const LABEL_LENGTH = 100;

/**
 * DELETE /comment/:id (soft delete). Allowed: the author, a manager (leader
 * or moderator) of the post's SIG, or an admin. A deletion by anyone but the
 * author is recorded in the audit log as `comment.remove`.
 */
export const remove: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const commentId = req.params.id;
    const userData = (req as ExtendedRequest).userData;
    const userId = String(userData._id);

    const comment = isValidObjectId(commentId)
      ? await CommentDB.read({ id: commentId }).catch(() => null)
      : null;
    if (!comment)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Comment not found"),
      );

    const isAuthor = String(comment.user) === userId;
    const access = isAuthor ? null : await moderatorAccess(comment, userData);
    if (!isAuthor && !access)
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not the author, a manager of the SIG or an admin"),
      );

    const removed = await CommentDB.remove(commentId);
    if (!removed)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Comment not found"),
      );

    if (access) {
      await recordAudit({
        actor: userId,
        action: "comment.remove",
        target: {
          kind: "comment",
          id: commentId,
          label: Array.from(String(comment.content ?? ""))
            .slice(0, LABEL_LENGTH)
            .join(""),
        },
        meta: {
          post: String(comment.post ?? ""),
          user: String(comment.user ?? ""),
          sig: access.sig,
          role: access.role,
        },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: commentId, removed: true },
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

/**
 * Why a user who is not the author may delete the comment: as a leader or
 * moderator of the post's SIG ("manager"), or as an admin. null when they may
 * not.
 */
async function moderatorAccess(
  comment: Comment,
  userData: ExtendedRequest["userData"],
) {
  const userId = String(userData._id);

  const post = isValidObjectId(comment.post)
    ? await PostDB.read(
        { id: comment.post },
        { lean: true, projection: { sig: 1 } },
      ).catch(() => null)
    : null;
  const sigId = post?.sig ? String(post.sig) : "";
  const sig =
    sigId && isValidObjectId(sigId)
      ? await SigDB.read({ id: sigId }).catch(() => null)
      : null;

  const isManager = sig ? isSigManager(sig, userId) : false;

  if (isManager) return { sig: sigId, role: "manager" as const };
  if (isAdmin(userData)) return { sig: sigId, role: "admin" as const };
  return null;
}
