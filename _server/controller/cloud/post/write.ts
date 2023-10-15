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
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        const forbiddenKeys = ["_id", "user", "like", "createAt", "updateAt", "__v"];
        const invalidKeys = Object.keys(body).filter(key => forbiddenKeys.includes(key));
        if (invalidKeys.length > 0 || Object.keys(body).length === 0) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("Body contains invalid keys"));
        }

        const { sig, title, cover, content, hashtag } = body;

        if (!sig || !title || !content || title === "" || content === "" || (cover && !await isValidCover(cover))) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid body"));
        }

        const sigData: Sig | null = await SigDB.read({ id: sig }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Sig not found"));

        const sigList: [Sig] = await SigDB.list({});
        const leaders = sigList.flatMap(sig => sig.leader);
        const moderators = sigList.flatMap(sig => sig.moderator);
        if (!leaders?.includes(decodedJwt.id) || !moderators?.includes(decodedJwt.id)) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not leader or moderator"));

        const dataToSave = {
            sig,
            title,
            cover: cover || "https://lazco.dev/sig-photo-coming-soon-picture",
            content,
            user: decodedJwt.id,
            hashtag
        };

        const oldData: Post | null = await PostDB.read({ id }).catch(() => null);
        if (!id && !oldData) {
            const savedData: Post = await PostDB.write(dataToSave);
            return res.status(HttpStatus.OK).json({
                status: CustomStatus.OK,
                id: savedData._id,
                cover: savedData.cover,
                data: savedData
            });
        }
        else if (!isValidObjectId(id)) {
            throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));
        }
        else if (!oldData) {
            throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));
        }
        else if (oldData?.user !== decodedJwt.id) {
            throw new CustomError(CustomStatus.INVALID_USER, new Error("Not author"));
        }

        const savedData: Post = await PostDB.write(dataToSave, { id });
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