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

        const sigList: [Sig] = await SigDB.list({});
        const isModerator = sigList.flatMap(sig => sig.moderator).includes(decodedJwt.id);
        const sigData = sigList.find(sig => sig._id?.toString() === oldData.sig);
        const isLeader = sigData?.leader?.includes(decodedJwt.id);
        try {
            if (oldData.user !== decodedJwt.id) throw new CustomError(CustomStatus.INVALID_USER, new Error("Not author"));
        }
        catch (error) {
            if (!isModerator && !isLeader) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not leader or moderator"));
        }

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
