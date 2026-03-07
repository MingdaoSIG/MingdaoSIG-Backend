import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export const listMembers: RequestHandler = async (
  request: Request | ExtendedRequest,
  response
) => {
  try {
    const extendedRequest = request as ExtendedRequest;
    const sigId = extendedRequest.params.sigId;

    if (!sigId || !isValidObjectId(sigId)) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Sig not found")
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

    // List all users that have this sig in their sig array
    const members = await UserDB.list({ sig: sigId });

    return response.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      count: members.length,
      data: members
    });
  }
  catch (error: any) {
    return response
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
