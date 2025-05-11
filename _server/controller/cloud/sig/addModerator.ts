import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";


const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export const addModerator: RequestHandler = async (
  req: Request | ExtendedRequest,
  res
) => {
  try {
    const { code } = req.body;
    const sigId = (req as Request).params.sigId;
    const decodedJwt: any = (req as ExtendedRequest).JWT;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(req as Request).onlyIncludesBody(["code"]);

    const sigList = await SigDB.list({});
    const sigData = sigList.find(sig => sig?._id?.toString() === sigId)!;

    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found")
      );
    }

    const userData = await UserDB.read({ id: decodedJwt.id }).catch(
      () => null
    );
    const isPermissionTwo = userData?.permission === 2;

    if (!isPermissionTwo) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not admin")
      );
    }

    if (sigData.removed) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Sig removed")
      );
    }

    const newCode = code.toLowerCase();
    const newModerator = await UserDB.read({ email: newCode }).catch(
      () => null
    );

    if (!newModerator) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );
    }

    const newModeratorId = newModerator._id?.toString() as string;

    if (sigData.moderator?.includes(newModeratorId)) {
      throw new CustomError(
        CustomStatus.ALREADY_MODERATOR,
        new Error("Already moderator")
      );
    }

    const dataToSave = {
      moderator: [...(sigData.moderator ?? []), newModeratorId]
    };

    const savedData = await SigDB.write(dataToSave, { id: sigId });
    if (!savedData) {
      throw new CustomError(
        CustomStatus.UNKNOWN_ERROR,
        new Error("Failed to add moderator")
      );
    }
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
