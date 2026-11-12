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

export const deleteModerator: RequestHandler<Record<string, string>> = async (
  request: Request<Record<string, string>> | ExtendedRequest,
  response,
) => {
  try {
    const extendedRequest = request as ExtendedRequest;
    const { moderatorId } = extendedRequest.body ?? {};
    const sigId = extendedRequest.params.sigId;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    new CheckRequestRequirement(extendedRequest).onlyIncludesBody([
      "moderatorId",
    ]);

    if (!moderatorId || !isValidObjectId(moderatorId)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid moderator id"),
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

    if (!sigData.moderator?.includes(moderatorId)) {
      throw new CustomError(
        CustomStatus.NOT_MODERATOR,
        new Error("User is not a moderator of this SIG"),
      );
    }

    const updatedModerators = sigData.moderator.filter(
      (id) => id !== moderatorId,
    );
    const dataToSave = {
      moderator: updatedModerators,
    };

    const savedData = await SigDB.write(dataToSave, { id: sigId });
    if (!savedData) {
      throw new CustomError(
        CustomStatus.UNKNOWN_ERROR,
        new Error("Failed to delete moderator"),
      );
    }

    const removed = await AdminDB.usersByIds([moderatorId], { name: 1 }).catch(
      () => new Map(),
    );
    await recordAudit({
      actor: String(userData._id),
      action: "sig.moderator.remove",
      target: {
        kind: "user",
        id: moderatorId,
        label: removed.get(moderatorId)?.name ?? "",
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
