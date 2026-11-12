import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin } from "@module/Permission";

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();

export const remove: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const postId = req.params.id;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    if (!isValidObjectId(postId))
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id"),
      );

    const oldData = await PostDB.read({ id: postId }).catch(() => null);
    if (!oldData)
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id"),
      );

    // The author, a leader of the post's SIG, a moderator of any SIG, or an
    // admin may delete a post.
    const sigList = await SigDB.list({});
    const isModerator = sigList
      .flatMap((sig) => sig.moderator)
      .includes(userId);
    const sigData = sigList.find((sig) => sig._id?.toString() === oldData.sig);
    const isLeader = sigData?.leader?.includes(userId);

    if (
      oldData.user !== userId &&
      !isModerator &&
      !isLeader &&
      !isAdmin(userData)
    ) {
      throw new CustomError(CustomStatus.INVALID_USER, new Error("Not author"));
    }

    await PostDB.write(
      {
        removed: true,
      },
      { id: postId },
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
