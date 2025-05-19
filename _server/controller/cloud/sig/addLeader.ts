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

export const addLeader: RequestHandler = async (
  request: Request | ExtendedRequest,
  response
) => {
  try {
    const extendedRequest = request as ExtendedRequest;
    const { code } = extendedRequest.body;
    const sigId = extendedRequest.params.sigId;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(extendedRequest).onlyIncludesBody(["code"]);

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

    const newCode = code.toUpperCase();
    const newLeader = await UserDB.read({ code: newCode }).catch(
      () => null
    );

    if (!newLeader) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );
    }

    const newLeaderId = newLeader?._id?.toString() as string;

    if (sigData.leader?.includes(newLeaderId)) {
      throw new CustomError(
        CustomStatus.ALREADY_LEADER,
        new Error("Already leader")
      );
    }

    const dataToSave = {
      leader: Array.from(new Set(sigData.leader ?? []).add(newLeaderId))
    };

    const savedData = await SigDB.write(dataToSave, { id: sigId });
    if (!savedData) {
      throw new CustomError(
        CustomStatus.UNKNOWN_ERROR,
        new Error("Failed to add leader")
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
