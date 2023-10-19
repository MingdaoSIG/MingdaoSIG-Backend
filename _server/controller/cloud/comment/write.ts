import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import axios from "axios";

import { Post } from "@type/post";
import { Sig } from "@type/sig";
import { Comment } from "@type/comment";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const CommentDB = new MongoDB("comment");

export const write: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const postId = (req as Request).params.commentId;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        const forbiddenKeys = ["_id", "user", "like", "createAt", "updateAt", "__v"];
        const invalidKeys = Object.keys(body).filter(key => forbiddenKeys.includes(key));
        if (invalidKeys.length > 0 || Object.keys(body).length === 0) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("Body contains invalid keys"));
        }

        const { post, content, reply }: Comment = body;

        if ((post && isValidObjectId(post)) || !content.trim()) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("No such title, content or sig id"));
        }

        const sigList: [Sig] = await SigDB.list({});
        const sigData = sigList.find(sig => sig?._id?.toString() === sigId)!;
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Sig not found"));
        if (sigData.removed && !sigData.moderator?.includes(decodedJwt.id)) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Sig removed"));

        if (!isValidObjectId(postId) && typeof (postId) !== "undefined") throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));


    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};