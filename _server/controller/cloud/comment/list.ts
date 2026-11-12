import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";
import { formatComment, readAuthors } from "./_shared";

const CommentDB = new MongoDB.Comment();
const PostDB = new MongoDB.Post();

const MAX_LIMIT = 100;

/**
 * GET /comment/list/post/:postId
 *
 * The post's top-level comments that are not removed, newest first (`skip`
 * and `limit` page through them; without `limit` every one is returned).
 * Each one carries its non-removed `replies`, oldest first, and
 * `replyCount`. Replies under a removed comment are not shown, and
 * CommentDB.countByPost does not count them either.
 */
export const listAllByPost: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const postId: string = req.params.postId;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req, MAX_LIMIT);

    if (
      !isValidObjectId(postId) ||
      !(await PostDB.read(
        { id: postId },
        { lean: true, projection: { _id: 1 } },
      ).catch(() => null))
    )
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id"),
      );

    const comments = await CommentDB.listTopLevel(postId, {
      skip: skip ? Number(skip) : 0,
      limit: limit ? Number(limit) : 0,
    });
    const replies = await CommentDB.listReplies(
      postId,
      comments.map((comment) => String(comment._id)),
    );

    const authors = await readAuthors(
      [...comments, ...replies].map((comment) => comment.user),
    );

    const repliesByParent = new Map<
      string,
      ReturnType<typeof formatComment>[]
    >();
    for (const reply of replies) {
      const parentId = String(reply.reply);
      const list = repliesByParent.get(parentId) ?? [];
      list.push(formatComment(reply, authors));
      repliesByParent.set(parentId, list);
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: comments.map((comment) => {
        const commentReplies = repliesByParent.get(String(comment._id)) ?? [];
        return {
          ...formatComment(comment, authors),
          replies: commentReplies,
          replyCount: commentReplies.length,
        };
      }),
    });
  } catch (error: any) {
    return res
      .status(
        error.statusCode
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      )
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
