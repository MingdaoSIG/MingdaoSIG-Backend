import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");

export const like: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        await PostDB.write({
            $addToSet: {
                like: decodedJwt.id
            }
        }, { id });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const dislike: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        await PostDB.write({
            $pull: {
                like: decodedJwt.id
            }
        }, { id });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
