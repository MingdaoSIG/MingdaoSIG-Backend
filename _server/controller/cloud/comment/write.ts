import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Comment } from "@type/comment";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";


const PostDB = new MongoDB("post");
const CommentDB = new MongoDB("comment");

export const write: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const commentId = (req as Request).params.commentId;
        const decodedJwt: any = (req as ExtendedRequest).JWT;
        const userId = decodedJwt.id;

        new CheckRequestRequirement(req as Request).matchBody(["post", "reply", "content"]);

        const {
            post: postId,
            reply: replyId,
            content
        }: {
            post: string,
            reply: string | "",
            content: string
        } = body;

        if (content.length > 250) throw new CustomError(CustomStatus.INVALID_CONTENT_LENGTH, new Error("Invalid content length"));
        if (content.trim() === "") throw new CustomError(CustomStatus.EMPTY_CONTENT, new Error("Content is empty"));

        if (!isValidObjectId(postId) || !(await PostDB.read({ id: postId }).catch(() => null))) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Post not found"));

        const validReplyTarget = replyId === "" ? true : await CommentDB.read({ id: replyId }).catch(() => null);
        if (!validReplyTarget) throw new CustomError(CustomStatus.INVALID_REPLY_ID, new Error("Reply not found"));

        const dataToSave: Comment = {
            user: userId,
            post: postId,
            content: content,
            reply: replyId,
        };

        const savedComment = await CommentDB.write(dataToSave, { id: commentId });
        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: savedComment._id,
            data: savedComment
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};