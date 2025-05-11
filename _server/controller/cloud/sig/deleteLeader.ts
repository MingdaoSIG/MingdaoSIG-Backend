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

export const deleteLeader: RequestHandler = async (
  req: Request | ExtendedRequest,
  res
) => {
  try {
    const { leaderId } = req.body;
    const sigId = (req as Request).params.sigId;
    const decodedJwt: any = (req as ExtendedRequest).JWT;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(req as Request).onlyIncludesBody([
      "leaderId"
    ]);

    if (!leaderId || !isValidObjectId(leaderId))
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid leader id")
      );

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

    if (!sigData.leader || !sigData.leader.includes(leaderId)) {
      throw new CustomError(
        CustomStatus.NOT_LEADER,
        new Error("User is not a leader of this SIG")
      );
    }

    const updatedLeaders = sigData.leader.filter(id => id !== leaderId);

    const dataToSave = {
      leader: updatedLeaders
    };

    const savedData = await SigDB.write(dataToSave, { id: sigId });
    if (!savedData) {
      throw new CustomError(
        CustomStatus.UNKNOWN_ERROR,
        new Error("Failed to delete leader")
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
