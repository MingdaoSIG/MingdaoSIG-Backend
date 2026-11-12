import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { recordAudit } from "@module/Audit";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import type { ExtendedRequest } from "@type/request";
import type { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

const SigDB = new MongoDB.Sig();
const AdminDB = new MongoDB.Admin();

export const deleteLeader: RequestHandler<Record<string, string>> = async (
  request: Request<Record<string, string>> | ExtendedRequest,
  response,
) => {
  try {
    const extendedRequest = request as ExtendedRequest;
    const { leaderId } = extendedRequest.body ?? {};
    const sigId = extendedRequest.params.sigId;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    new CheckRequestRequirement(extendedRequest).onlyIncludesBody(["leaderId"]);

    if (!leaderId || !isValidObjectId(leaderId)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid leader id"),
      );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig not found"),
      );
    }

    if (sigData.removed) {
      throw new CustomError(CustomStatus.FORBIDDEN, new Error("Sig removed"));
    }

    const userData = extendedRequest.userData;
    const isPermissionTwo = userData?.permission === 2;
    if (!isPermissionTwo) {
      throw new CustomError(CustomStatus.FORBIDDEN, new Error("Not admin"));
    }

    if (!sigData.leader?.includes(leaderId)) {
      throw new CustomError(
        CustomStatus.NOT_LEADER,
        new Error("User is not a leader of this SIG"),
      );
    }

    const updatedLeaders = sigData.leader.filter((id) => id !== leaderId);
    const dataToSave = {
      leader: updatedLeaders,
    };

    const savedData = await SigDB.write(dataToSave, { id: sigId });
    if (!savedData) {
      throw new CustomError(
        CustomStatus.UNKNOWN_ERROR,
        new Error("Failed to delete leader"),
      );
    }

    const removed = await AdminDB.usersByIds([leaderId], { name: 1 }).catch(
      () => new Map(),
    );
    await recordAudit({
      actor: String(userData._id),
      action: "sig.leader.remove",
      target: {
        kind: "user",
        id: leaderId,
        label: removed.get(leaderId)?.name ?? "",
      },
      meta: { sig: sigId },
    });

    return response.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData,
    });
  } catch (error: any) {
    return response
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
