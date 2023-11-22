import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import _MongoDB from "@module/MongoDB";


const PostDB = new _MongoDB("post");

export const read: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const postData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!postData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Post not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: postData._id,
            data: postData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};