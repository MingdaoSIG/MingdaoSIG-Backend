import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@type/customError";
import { Post } from "@type/post";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");

export const read: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const postData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!postData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Post not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: postData._id,
            postData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};