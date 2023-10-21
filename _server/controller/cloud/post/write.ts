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

const sigDefaultCover: { [key: string]: string } = {
    "651799ebfa1d45d97b139864": "https://i.ibb.co/WnFmWzV/image.png", // 資安
    "6529ed87df4ae96f279cd5e3": "https://i.ibb.co/1dTBSBz/image.png", // 資訊程式設計
    "6529ee3cdf4ae96f279cd5e4": "https://i.ibb.co/JnxbWgM/image.png", // 機器人設計與製造
    "6529ee57df4ae96f279cd5e5": "https://i.ibb.co/vVwzchq/image.png", // 建築設計
    "6529eed9df4ae96f279cd5e6": "https://i.ibb.co/TvwkHxn/image.png", // 生科動科與環境
    "6529eeeddf4ae96f279cd5e7": "https://i.ibb.co/pzS94CM/image.png", // 醫學
    "6529efbfdf4ae96f279cd5ec": "https://i.ibb.co/xs69FqH/image.png", // 醫學相關
    "6529efe9df4ae96f279cd5ee": "https://i.ibb.co/ygVnfVm/image.png", // 法政
    "6529effbdf4ae96f279cd5ef": "", // 社心教育
    "6529f011df4ae96f279cd5f0": "https://i.ibb.co/pzfBgdP/image.png", // 音樂表藝
    "6529f05ddf4ae96f279cd5f1": "https://i.ibb.co/FXjMXQs/image.png", // 大眾傳播
    "6529f06edf4ae96f279cd5f2": "https://i.ibb.co/FztWpQ2/image.png", // 文史哲
    "6529f07ddf4ae96f279cd5f3": "", // 財經
    "6529f094df4ae96f279cd5f4": "https://i.ibb.co/znBp0Qm/image.png", // 無人機
    "6529f0a2df4ae96f279cd5f5": "", // 經濟與管理
    "6529f0c4df4ae96f279cd5f6": "https://i.ibb.co/DWggfbB/image.png", // 元宇宙
    "6529f0dbdf4ae96f279cd5f7": "https://i.ibb.co/yPsp1PY/image.png", // 直播
    "6529f0eedf4ae96f279cd5f8": "https://i.ibb.co/56JF3fX/image.png", // 科學教育
    "652b851ca1bd096e024475c4": "https://i.ibb.co/sC88YBs/image.png", // 雲端
};

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
        // const isOneOfModerators = sigList.flatMap(sig => sig.moderator).includes(decodedJwt.id);
        // const isOneOfLeaders = sigList.flatMap(sig => sig.leader).includes(decodedJwt.id);
        const dataToSave = {
            sig: sigId,
            title,
            cover: cover || sigDefaultCover[sigId] || "https://lazco.dev/sig-photo-coming-soon-picture",
            content,
            user: decodedJwt.id,
            hashtag
        };
        if (typeof (postId) !== "undefined" && !oldData) {
            throw new CustomError(CustomStatus.INVALID_POST_ID, new Error("Invalid post id"));
        }
        // else if (!isOneOfModerators && !isOneOfLeaders && oldData?.user !== decodedJwt.id) {
        //     throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not leader, moderator or author"));
        // }
        else if (typeof (postId) !== "undefined" && oldData?.user !== decodedJwt.id) {
            throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not author"));
        }

        const writeOptions = postId ? { id: postId } : undefined;
        const savedData = await PostDB.write(dataToSave, writeOptions);
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