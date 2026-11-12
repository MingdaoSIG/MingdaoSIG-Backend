import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import axios from "axios";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { canPostToSig, isAdmin, isSigModerator } from "@module/Permission";
import { announceNewPost } from "@module/DiscordWebhook";

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();

// Matches the editor's limit in the frontend (app/new/page.tsx).
const MAX_CONTENT_LENGTH = 100000;

// Image ids (served by GET /image/:id), like the frontend's own table in
// app/new/(new)/apis/postAPI.ts. A full URL would tie stored posts to one
// API host.
const sigDefaultCover: { [key: string]: string } = {
  "6529ed87df4ae96f279cd5e3": "653299ff0b891d1f6b5b4460", // 資訊程式設計
  "6529ee3cdf4ae96f279cd5e4": "653297ed0b891d1f6b5b4416", // 機器人
  "6529ee57df4ae96f279cd5e5": "653299f10b891d1f6b5b445c", // 建築設計
  "6529eed9df4ae96f279cd5e6": "6532988f0b891d1f6b5b4432", // 生科動科與環境
  "6529eeeddf4ae96f279cd5e7": "653298e00b891d1f6b5b4446", // 醫學
  "6529efbfdf4ae96f279cd5ec": "6532983d0b891d1f6b5b4422", // 醫學相關
  "6529efe9df4ae96f279cd5ee": "6532982d0b891d1f6b5b441e", // 法政
  "6529effbdf4ae96f279cd5ef": "653298c70b891d1f6b5b4442", // 社心教育
  "6529f011df4ae96f279cd5f0": "65329a0f0b891d1f6b5b4464", // 音樂表藝
  "6529f05ddf4ae96f279cd5f1": "653298fa0b891d1f6b5b444e", // 大眾傳播
  "6529f06edf4ae96f279cd5f2": "653298490b891d1f6b5b4426", // 文史哲
  "6529f094df4ae96f279cd5f4": "653298b00b891d1f6b5b443e", // 無人機
  "6529f0a2df4ae96f279cd5f5": "653298620b891d1f6b5b442e", // 經濟管科
  "6529f0c4df4ae96f279cd5f6": "653298a60b891d1f6b5b443a", // 元宇宙
  "6529f0dbdf4ae96f279cd5f7": "653298570b891d1f6b5b442a", // 直播
  "6529f0eedf4ae96f279cd5f8": "653298110b891d1f6b5b441a", // 科學教育
  "652d60b842cdf6a660c2b778": "653299930b891d1f6b5b4458", // 公告
  "65321d65e226c78161c22807": "653298990b891d1f6b5b4436", // 遊憩運動
  "65321d83e226c78161c22808": "653299040b891d1f6b5b4452", // 電機物理
  "6ad18a858a01ead1f9d558a7": "6ad18a858a01ead1f9d558a8", // 模擬聯合國
  "6ad18a858a01ead1f9d558a9": "6ad18a858a01ead1f9d558aa", // 數學
};

export const write: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const { body } = req;
    const postId = req.params.id;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    new CheckRequestRequirement(req as Request).forbiddenBody([
      "_id",
      "user",
      "like",
      "priority",
      "pinned",
      "removed",
      "createAt",
      "updateAt",
      "__v",
    ]);

    const { sig: sigId, title, cover, content, hashtag } = body;

    checkHashtag(hashtag);
    checkContent(content);

    if (
      !isValidObjectId(sigId) ||
      (title &&
        title.trim() === "" &&
        content &&
        content.trim() === "" &&
        !(await isValidCover(cover)))
    ) {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("Title, content, cover or sig id is invalid"),
      );
    }

    const sigList = await SigDB.list({});
    const sigData = sigList.find((sig) => sig?._id?.toString() === sigId);
    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found"),
      );
    }
    // removed sig only allow its moderators
    if (
      sigData.removed &&
      !isSigModerator(sigData, userId) &&
      !isAdmin(userData)
    ) {
      throw new CustomError(CustomStatus.FORBIDDEN, new Error("Sig removed"));
    }

    const oldData = postId
      ? await PostDB.read({ id: postId }).catch(() => null)
      : null;

    if (postId) {
      if (!isValidObjectId(postId) || !oldData) {
        throw new CustomError(
          CustomStatus.INVALID_POST_ID,
          new Error("Invalid post id"),
        );
      }

      if (oldData.user !== userId && !isAdmin(userData)) {
        throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not author"));
      }

      // Moving a post needs the same permission as posting in the new sig
      if (
        String(sigId) !== String(oldData.sig) &&
        !canPostToSig(userData, userId, sigData, sigList)
      ) {
        throw new CustomError(
          CustomStatus.FORBIDDEN,
          new Error("Not allowed to post in the target sig"),
        );
      }
    } else if (!canPostToSig(userData, userId, sigData, sigList)) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not allowed to post in this sig"),
      );
    }

    const dataToSave = {
      sig: sigId || oldData?.sig,
      title: title || oldData?.title,
      // No cover at all for a SIG missing from the table: the frontend
      // shows the post without one.
      cover: cover || oldData?.cover || sigDefaultCover[sigId] || "",
      content: content || oldData?.content,
      user: oldData?.user || userId,
      hashtag: hashtag || oldData?.hashtag || [],
    };
    const writeOptions = postId ? { id: postId } : undefined;
    const savedData = await PostDB.write(dataToSave, writeOptions);
    // A new post goes to the SIG's Discord channel, if set (fire and forget).
    if (!postId)
      announceNewPost({
        post: savedData,
        authorName: userData?.name ?? "",
        apiBaseUrl: `${req.protocol}://${req.get("host") ?? ""}`,
      });
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

function checkContent(content: unknown) {
  if (content === undefined || content === null) return;

  if (typeof content !== "string")
    throw new CustomError(
      CustomStatus.INVALID_BODY,
      new Error("Invalid content"),
    );

  if (content.length > MAX_CONTENT_LENGTH)
    throw new CustomError(
      CustomStatus.INVALID_CONTENT_LENGTH,
      new Error("Invalid content length"),
    );
}

function checkHashtag(hashtags: string[]) {
  if (!hashtags || hashtags.length === 0) return true;

  if (typeof hashtags !== "object")
    throw new CustomError(
      CustomStatus.INVALID_HASHTAG,
      new Error("Invalid hashtag"),
    );

  hashtags.forEach((hashtag: string) => {
    if (hashtag.trim() === "")
      throw new CustomError(
        CustomStatus.INVALID_HASHTAG,
        new Error("Invalid hashtag"),
      );
  });
}

async function isValidCover(url: string) {
  if (!url) return false;
  try {
    await axios.get(url);
    return true;
  } catch {
    return false;
  }
}
