import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
// import CheckValidCustomId from "@module/CheckValidCustomId";

const SigDB = new MongoDB.Sig();

export const write: RequestHandler = async (
  req: Request | ExtendedRequest,
  res
) => {
  try {
    const {
      // customId,
      description
    } = req.body;
    const sigId = (req as Request).params.id;
    const decodedJwt: any = (req as ExtendedRequest).JWT;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(req as Request).onlyIncludesBody(
      // ["customId", "description"],
      ["description"]
    );

    const sigList = await SigDB.list({});
    const sigData = sigList.find(sig => sig?._id?.toString() === sigId)!;
    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found")
      );
    }

    const isOneOfModerators = sigList
      .flatMap(sig => sig.moderator)
      .includes(decodedJwt.id);
    const isOneOfLeaders = sigList
      .flatMap(sig => sig.leader)
      .includes(decodedJwt.id);
    if (!isOneOfModerators && !isOneOfLeaders) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not leader or moderator")
      );
    }

    if (sigData.removed && !sigData.moderator?.includes(decodedJwt.id)) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Sig removed")
      );
    }

    // if (sigData.customId !== customId) {
    //   await CheckValidCustomId(customId);
    // }

    if (description && description?.length > 250)
      throw new CustomError(
        CustomStatus.INVALID_CONTENT_LENGTH,
        new Error("Invalid description")
      );

    const dataToSave = {
      // customId: String(customId ?? sigData.customId),
      description: String(description ?? sigData.description)
    };
    const savedData = await SigDB.write(dataToSave, { id: sigId });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
