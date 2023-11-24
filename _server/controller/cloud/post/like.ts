import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB.Post();

export const like: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData = await PostDB.read({ id }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        if (!oldData.like?.includes(decodedJwt.id)) {
            await PostDB.write({
                // @ts-ignore
                $addToSet: {
                    like: decodedJwt.id
                },
                likes: (oldData.like?.length || 0) + 1
            }, { id });
        }

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

        const oldData = await PostDB.read({ id }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        if (oldData.like?.includes(decodedJwt.id)) {
            await PostDB.write({
                // @ts-ignore
                $pull: {
                    like: decodedJwt.id
                },
                likes: (oldData.like.length || 0) - 1
            }, { id });
        }

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
