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
import { sigDefaultCover } from "@module/SigDefaults";

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();

// Matches the editor's limit in the frontend (app/new/page.tsx).
const MAX_CONTENT_LENGTH = 100000;

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
      // The SIG's default cover (sig.defaultCover, else the old hardcoded
      // table); none at all when it has neither: the frontend shows the post
      // without one.
      cover: cover || oldData?.cover || sigDefaultCover(sigData),
      content: content || oldData?.content,
      user: oldData?.user || userId,
      hashtag: hashtag || oldData?.hashtag || [],
    };
    const writeOptions = postId ? { id: postId } : undefined;
    const savedData = await PostDB.write(dataToSave, writeOptions);
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
