import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { Comment } from "@type/comment";


const CommentDB = new MongoDB("comment");
const PostDB = new MongoDB("post");

export const listAllByPost: RequestHandler = async (req, res) => {
    try {
        const postId: string = req.params.postId!;

        if (!isValidObjectId(postId) || !(await PostDB.read({ id: postId }).catch(() => null))) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        return await listCommentBy(res, { post: postId, reply: "" });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

async function listCommentBy(res: Response, search: FilterQuery<Comment>) {
    const commentData: Comment[] | null = await CommentDB.list({
        ...search,
        removed: false
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        postData: commentData
    });
}