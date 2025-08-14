import CheckRequestRequirement from "@module/CheckRequestRequirement";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import type { ExtendedRequest } from "@type/request";
import type { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";


const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export const deleteLeader: RequestHandler = async (
  request: Request | ExtendedRequest,
  response
) => {
  try {
    const extendedRequest = request as ExtendedRequest;
    const { leaderId } = extendedRequest.body;
    const sigId = extendedRequest.params.sigId;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(extendedRequest).onlyIncludesBody([
      "leaderId"
    ]);

    if (!leaderId || !isValidObjectId(leaderId)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid leader id")
      );
    }

    const leaderData = await UserDB.read({ id: leaderId }).catch(
      () => null
    );
    if (!leaderData) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid leader id")
      );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found")
      );
    }

    if (sigData.removed) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Sig removed")
      );
    }

    const userData = extendedRequest.userData;
    const isPermissionTwo = userData?.permission === 2;
    if (!isPermissionTwo) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Not admin")
      );
    }

    if (!sigData.leader || !sigData.leader?.includes(leaderId)) {
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

    return response.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData
    });
  }
  catch (error: any) {
    return response
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
