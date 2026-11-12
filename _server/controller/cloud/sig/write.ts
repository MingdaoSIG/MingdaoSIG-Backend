import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { isAdmin, isSigLeader, isSigModerator } from "@module/Permission";
// import CheckValidCustomId from "@module/CheckValidCustomId";

const SigDB = new MongoDB.Sig();

export const write: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const {
      // customId,
      description,
    } = req.body ?? {};
    const sigId = req.params.id;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId: string = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    new CheckRequestRequirement(req as Request).onlyIncludesBody(
      // ["customId", "description"],
      ["description"],
    );

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found"),
      );
    }

    // Only this sig's leaders and moderators (advisors), or an admin
    const isModerator = isSigModerator(sigData, userId);
    const isLeader = isSigLeader(sigData, userId);
    const isAdminUser = isAdmin(userData);
    if (!isModerator && !isLeader && !isAdminUser) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not leader or moderator of this sig"),
      );
    }

    if (sigData.removed && !isModerator && !isAdminUser) {
      throw new CustomError(CustomStatus.FORBIDDEN, new Error("Sig removed"));
    }

    // if (sigData.customId !== customId) {
    //   await CheckValidCustomId(customId);
    // }

    if (description && description?.length > 250)
      throw new CustomError(
        CustomStatus.INVALID_CONTENT_LENGTH,
        new Error("Invalid description"),
      );

    const dataToSave = {
      // customId: String(customId ?? sigData.customId),
      description: String(description ?? sigData.description),
    };
    const savedData = await SigDB.write(dataToSave, { id: sigId });

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
