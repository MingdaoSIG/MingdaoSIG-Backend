import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import CustomError from "@type/customError";
import { Comment } from "@type/comment";
import { User } from "@type/user";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const CommentDB = new MongoDB("comment");
const PostDB = new MongoDB("post");
const UserDB = new MongoDB("user");

export const listAllByPost: RequestHandler = async (req, res) => {
    try {
        const postId: string = req.params.postId!;

        if (!isValidObjectId(postId) || !(await PostDB.read({ id: postId }).catch(() => null))) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        return await listCommentBy(res, { post: postId, reply: "" });
    }
    catch (error: any) {
        return res.status(error.statusCode ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

async function listCommentBy(res: Response, search: FilterQuery<Comment>) {
    const commentData: Comment[] | null = await CommentDB.list({
        ...search,
        removed: false
    });

    const userIds = new Set<string>();
    commentData?.forEach((comment) => {
        userIds.add(comment.user);
    });

    const usersDataMap: Record<string, User> = {};
    const usersData: User[] = await UserDB.list({ _id: { $in: Array.from(userIds) } });
    usersData.forEach((user) => {
        if (user._id) {
            usersDataMap[user._id] = user;
        }
    });

    const commentDataWithUser = commentData?.map((comment) => {
        comment = JSON.parse(JSON.stringify(comment));
        return {
            ...comment,
            user: {
                customId: usersDataMap[comment.user]?.customId,
                avatar: usersDataMap[comment.user]?.avatar
            }
        };
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        postData: commentDataWithUser
    });
}