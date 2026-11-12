import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { checkContent, formatComment, readAuthors, sendError } from "./_shared";

const CommentDB = new MongoDB.Comment();

// POST /comment/:id with { content }: only the comment's author may edit it.
// Returns the comment in the comment list shape (with `edited`).
export const edit: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const commentId = req.params.id;
    const userId = String((req as ExtendedRequest).userData._id);

    new CheckRequestRequirement(req as Request).matchBody(["content"]);
    const { content } = req.body;
    checkContent(content);

    const comment = isValidObjectId(commentId)
      ? await CommentDB.read({ id: commentId }).catch(() => null)
      : null;
    if (!comment)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Comment not found"),
      );

    if (String(comment.user) !== userId)
      throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not author"));

    const updated = await CommentDB.editContent(commentId, content);
    if (!updated)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Comment not found"),
      );

    const authors = await readAuthors([userId]);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: formatComment(updated, authors),
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};
