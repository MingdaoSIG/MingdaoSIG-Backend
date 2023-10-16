import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { Sig } from "@type/sig";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");
const SigDB = new MongoDB("sig");

export const remove: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const postId = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        if (!isValidObjectId(postId)) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData: Post | null = await PostDB.read({ id: postId }).catch(() => null);
        if (!oldData) throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        if (oldData.user !== decodedJwt.id) throw new CustomError(CustomStatus.INVALID_USER, new Error("Not author"));

        const sigList: [Sig] = await SigDB.list({});
        const moderators = sigList.flatMap(sig => sig.moderator);
        const sigData = sigList.find(sig => sig._id === postId);
        const leader = sigData?.leader;

        if (!leader?.includes(decodedJwt.id) || !moderators.includes(decodedJwt.id)) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not leader or moderator"));

        await PostDB.write({
            removed: true
        }, { id: postId });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
