import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import axios from "axios";

import { Post } from "@type/post";
import { Sig } from "@type/sig";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");
const SigDB = new MongoDB("sig");

export const write: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const postId = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        const forbiddenKeys = ["_id", "user", "like", "createAt", "updateAt", "__v"];
        const invalidKeys = Object.keys(body).filter(key => forbiddenKeys.includes(key));
        if (invalidKeys.length > 0 || Object.keys(body).length === 0) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("Body contains invalid keys"));
        }

        const { sig: sigId, title, cover, content, hashtag }: Post = body;

        if (!sigId || !title || !content || title.trim() === "" || content.trim() === "" || (cover && !await isValidCover(cover))) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("No title, content or sig id"));
        }

        const sigList: [Sig] = await SigDB.list({});
        const sigData = sigList.find(sig => sig?._id?.toString() === sigId)!;
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Sig not found"));
        if (sigData.removed && !sigData.moderator?.includes(decodedJwt.id)) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Sig removed"));

        if (!isValidObjectId(postId) && typeof (postId) !== "undefined") throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));

        const oldData: Post = await PostDB.read({ id: postId }).catch(() => null);
        const isOneOfModerators = sigList.flatMap(sig => sig.moderator).includes(decodedJwt.id);
        const isOneOfLeaders = sigList.flatMap(sig => sig.leader).includes(decodedJwt.id);
        const dataToSave = {
            sig: sigId,
            title,
            cover: cover || "https://lazco.dev/sig-photo-coming-soon-picture",
            content,
            user: decodedJwt.id,
            hashtag
        };
        if (typeof (postId) !== "undefined" && !oldData) {
            throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));
        }
        else if (!isOneOfModerators && !isOneOfLeaders && oldData?.user !== decodedJwt.id) {
            throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not leader, moderator or author"));
        }
        else if (typeof (postId) !== "undefined" && oldData?.user !== decodedJwt.id) {
            throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not author"));
        }

        const writeOptions = postId ? { id: postId } : undefined;
        const writePromise = PostDB.write(dataToSave, writeOptions);
        const savedData = await writePromise;
        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: savedData._id,
            data: savedData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

async function isValidCover(url: string) {
    if (!url) return false;
    try {
        await axios.get(url);
        return true;
    }
    catch (error) {
        return false;
    }
}