import { Response } from "express";
import { isValidObjectId } from "mongoose";

import { Comment } from "@type/comment";
import { User } from "@type/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";

const UserDB = new MongoDB.User();

// Same limit as before the edit feature.
export const MAX_CONTENT_LENGTH = 250;
// A comment saved again more than this long after it was created shows
// 「（已編輯）」.
const EDITED_AFTER_MS = 5000;

export type CommentAuthor = Pick<User, "_id" | "customId" | "name" | "avatar">;

/** Content is a string of 1 to 250 characters that is not only spaces. */
export function checkContent(content: unknown): asserts content is string {
  if (typeof content !== "string")
    throw new CustomError(
      CustomStatus.INVALID_BODY,
      new Error("Content is not a string"),
    );
  if (content.length > MAX_CONTENT_LENGTH)
    throw new CustomError(
      CustomStatus.INVALID_CONTENT_LENGTH,
      new Error("Invalid content length"),
    );
  if (content.trim() === "")
    throw new CustomError(
      CustomStatus.EMPTY_CONTENT,
      new Error("Content is empty"),
    );
}

export function isEdited(comment: Pick<Comment, "createdAt" | "updatedAt">) {
  if (!comment.createdAt || !comment.updatedAt) return false;
  const created = new Date(comment.createdAt).getTime();
  const updated = new Date(comment.updatedAt).getTime();
  return updated - created > EDITED_AFTER_MS;
}

/** The public fields of the given authors, by user id. */
export async function readAuthors(userIds: string[]) {
  const ids = Array.from(new Set(userIds)).filter((id) => isValidObjectId(id));
  const authors = new Map<string, CommentAuthor>();
  if (ids.length === 0) return authors;

  const users = await UserDB.list(
    { _id: { $in: ids } },
    { lean: true, projection: { customId: 1, name: 1, avatar: 1 } },
  );
  for (const user of users) {
    if (user._id) authors.set(String(user._id), user);
  }
  return authors;
}

/**
 * A comment as the comment list returns it: the stored fields, the author's
 * public fields instead of the user id, and `edited`.
 */
export function formatComment(
  comment: Comment,
  authors: Map<string, CommentAuthor>,
) {
  const author = authors.get(String(comment.user));
  return {
    ...comment,
    _id: String(comment._id),
    reply: comment.reply ?? "",
    user: {
      _id: comment.user,
      customId: author?.customId,
      name: author?.name,
      avatar: author?.avatar,
    },
    edited: isEdited(comment),
  };
}

/** HTTP status for a custom status code thrown by a comment handler. */
export function sendError(res: Response, error: any) {
  const status: number = error?.statusCode || CustomStatus.UNKNOWN_ERROR;
  return res.status(httpStatusFor(status)).json({ status });
}

function httpStatusFor(status: number) {
  switch (status) {
    case CustomStatus.NOT_FOUND:
    case CustomStatus.INVALID_QUERY:
      return HttpStatus.NOT_FOUND;
    case CustomStatus.FORBIDDEN:
      return HttpStatus.FORBIDDEN;
    case CustomStatus.INVALID_JWT:
      return HttpStatus.UNAUTHORIZED;
    default:
      return status >= 4100
        ? HttpStatus.INTERNAL_SERVER_ERROR
        : HttpStatus.BAD_REQUEST;
  }
}
