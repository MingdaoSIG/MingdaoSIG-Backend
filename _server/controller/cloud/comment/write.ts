import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Comment } from "@type/comment";
import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import notifyNewComment from "@module/CommentNotification";
import { checkContent } from "./_shared";

const PostDB = new MongoDB.Post();
const CommentDB = new MongoDB.Comment();

// POST /comment with { post, content, reply }. `reply` is "" (or null) for
// a top-level comment, otherwise the id of the comment replied to.
export const write: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const { body } = req;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    new CheckRequestRequirement(req as Request).matchBody([
      "post",
      "reply",
      "content",
    ]);

    const { post: postId, reply: replyId, content } = body;

    checkContent(content);

    if (typeof postId !== "string" || !isValidObjectId(postId))
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id"),
      );
    const postData = await PostDB.read(
      { id: postId },
      { lean: true, projection: { title: 1, user: 1 } },
    ).catch(() => null);
    if (!postData)
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Post not found"),
      );

    const parent = await replyTarget(replyId, postId);

    const savedComment = await CommentDB.write({
      user: userId,
      post: postId,
      content: content,
      reply: parent ? String(parent._id) : "",
    });

    notifyNewComment({
      actorId: userId,
      actorName: userData?.name,
      post: { _id: postId, title: postData.title, user: postData.user },
      content,
      parentAuthorId: parent?.user,
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedComment._id,
      data: savedComment,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

/**
 * The top-level comment a new comment is attached to, or null for a
 * top-level comment. There is one level of replies: replying to a reply
 * attaches to that reply's parent. The target (and that parent) must be a
 * comment of the same post that is not removed; anything else is 4011.
 */
async function replyTarget(
  replyId: unknown,
  postId: string,
): Promise<Comment | null> {
  if (replyId === "" || replyId === null) return null;

  const target = await readVisibleComment(replyId, postId);
  if (!target.reply) return target;

  const parent = await readVisibleComment(target.reply, postId);
  if (parent.reply) throw invalidReply("Reply target is nested too deep");
  return parent;
}

async function readVisibleComment(id: unknown, postId: string) {
  if (typeof id !== "string" || !isValidObjectId(id))
    throw invalidReply("Invalid reply id");

  const comment = await CommentDB.read({ id }).catch(() => null);
  if (!comment) throw invalidReply("Reply target not found");
  if (String(comment.post) !== postId)
    throw invalidReply("Reply target is on another post");

  return comment;
}

function invalidReply(message: string) {
  return new CustomError(CustomStatus.INVALID_BODY, new Error(message));
}
