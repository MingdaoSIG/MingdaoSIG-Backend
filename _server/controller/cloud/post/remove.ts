import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { RequestContainJWT } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");

export const remove: RequestHandler = async (req: Request | RequestContainJWT, res) => {
    try {
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as RequestContainJWT).JWT;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        if (oldData.user !== decodedJwt.id) throw new CustomError(CustomStatus.INVALID_USER, new Error("Invalid user"));

        await PostDB.write({
            removed: true
        }, { id });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
