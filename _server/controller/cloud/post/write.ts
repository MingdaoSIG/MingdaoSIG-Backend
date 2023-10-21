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
    "651799ebfa1d45d97b139864": "https://sig-api.lazco.dev/image/653296b40b891d1f6b5b4412", // 資安
    "6529ed87df4ae96f279cd5e3": "https://sig-api.lazco.dev/image/653299ff0b891d1f6b5b4460", // 資訊程式設計
    "6529ee3cdf4ae96f279cd5e4": "https://sig-api.lazco.dev/image/653297ed0b891d1f6b5b4416", // 機器人
    "6529ee57df4ae96f279cd5e5": "https://sig-api.lazco.dev/image/653299f10b891d1f6b5b445c", // 建築設計
    "6529eed9df4ae96f279cd5e6": "https://sig-api.lazco.dev/image/6532988f0b891d1f6b5b4432", // 生科動科與環境
    "6529eeeddf4ae96f279cd5e7": "https://sig-api.lazco.dev/image/653298e00b891d1f6b5b4446", // 醫學
    "6529efbfdf4ae96f279cd5ec": "https://sig-api.lazco.dev/image/6532983d0b891d1f6b5b4422", // 醫學相關
    "6529efe9df4ae96f279cd5ee": "https://sig-api.lazco.dev/image/6532982d0b891d1f6b5b441e", // 法政
    "6529effbdf4ae96f279cd5ef": "https://sig-api.lazco.dev/image/653298c70b891d1f6b5b4442", // 社心教育
    "6529f011df4ae96f279cd5f0": "https://sig-api.lazco.dev/image/65329a0f0b891d1f6b5b4464", // 音樂表藝
    "6529f05ddf4ae96f279cd5f1": "https://sig-api.lazco.dev/image/653298fa0b891d1f6b5b444e", // 大眾傳播
    "6529f06edf4ae96f279cd5f2": "https://sig-api.lazco.dev/image/653298490b891d1f6b5b4426", // 文史哲
    "6529f07ddf4ae96f279cd5f3": "https://sig-api.lazco.dev/image/653298eb0b891d1f6b5b444a", // 財經
    "6529f094df4ae96f279cd5f4": "https://sig-api.lazco.dev/image/653298b00b891d1f6b5b443e", // 無人機
    "6529f0a2df4ae96f279cd5f5": "https://sig-api.lazco.dev/image/653298620b891d1f6b5b442e", // 經濟與管理
    "6529f0c4df4ae96f279cd5f6": "https://sig-api.lazco.dev/image/653298a60b891d1f6b5b443a", // 元宇宙
    "6529f0dbdf4ae96f279cd5f7": "https://sig-api.lazco.dev/image/653298570b891d1f6b5b442a", // 直播
    "6529f0eedf4ae96f279cd5f8": "https://sig-api.lazco.dev/image/653298110b891d1f6b5b441a", // 科學教育
    "652d60b842cdf6a660c2b778": "https://sig-api.lazco.dev/image/653299930b891d1f6b5b4458", // 公告
    "65321d65e226c78161c22807": "https://sig-api.lazco.dev/image/653298990b891d1f6b5b4436", // 遊憩運動
    "65321d83e226c78161c22808": "https://sig-api.lazco.dev/image/653299040b891d1f6b5b4452", // 電機物理
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