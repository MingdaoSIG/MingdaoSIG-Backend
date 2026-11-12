import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import NewJoinRequest from "@module/NewJoinRequest";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();
const JoinRequestDB = new MongoDB.JoinRequest();

export const join: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res
) => {
  try {
    const { body } = req;
    const sigId = req.params.sigId;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    new CheckRequestRequirement(req as Request).matchBody([
      "q1",
      "q2",
      "q3"
    ]);

    const { q1, q2, q3 } = body;

    if (q1.length > 250 || q2.length > 250 || q3.length > 250) {
      throw new CustomError(
        CustomStatus.INVALID_CONTENT_LENGTH,
        new Error("Invalid content length")
      );
    }

    if (q1.trim() === "" || q2.trim() === "" || q3.trim() === "") {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("q1, q2 or q3 is empty")
      );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData || sigData.removed) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found")
      );
    }

    const userData = await UserDB.read({ id: userId });
    if (userData.sig?.includes(sigId)) {
      throw new CustomError(
        CustomStatus.ALREADY_JOINED,
        new Error("Already joined")
      );
    }

    const oldJoinRequest = await JoinRequestDB.read({
      user: userId,
      sig: sigId
    }).catch(() => null);
    if (oldJoinRequest && oldJoinRequest.state === "pending") {
      throw new CustomError(
        CustomStatus.ALREADY_APPLIED,
        new Error("Already applied")
      );
    }

    const requestData = await JoinRequestDB.write({
      user: userId,
      sig: sigId,
      q1,
      q2,
      q3,
      state: "pending"
    });

    try {
      await NewJoinRequest(sigId, userId, requestData);
    }
    catch (error) {
      // Leaders were not notified: drop the request so the user can retry
      // instead of being stuck with "already applied".
      await JoinRequestDB.remove(requestData._id).catch(() => null);
      throw error;
    }

    requestData.confirmId = undefined;
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: requestData._id,
      data: requestData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const readJoinRequest: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res
) => {
  try {
    const sigId = req.params.sigId;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;

    const oldJoinRequest = await JoinRequestDB.read({
      user: userId,
      sig: sigId
    });

    if (!oldJoinRequest) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Request not found")
      );
    }

    oldJoinRequest.confirmId = undefined;

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      state: oldJoinRequest.state,
      data: oldJoinRequest
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
