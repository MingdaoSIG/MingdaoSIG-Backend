import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { isAdmin, isSigLeader, isSigModerator } from "@module/Permission";
import { recordAudit } from "@module/Audit";
import { SigWrite } from "@type/sig";

const SigDB = new MongoDB.Sig();
const AdminDB = new MongoDB.Admin();

const NAME_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 250;

// POST /sig/:id { description?, avatar?, name? }: the SIG's leaders and
// moderators (advisors) or an admin; only an admin may rename it.
export const write: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const { description, avatar, name } = req.body ?? {};
    const sigId = req.params.id;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId: string = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    if (!sigId || !isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    new CheckRequestRequirement(req as Request).onlyIncludesBody([
      "description",
      "avatar",
      "name",
    ]);

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

    if (name !== undefined && !isAdminUser) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error("Only an admin can rename a sig"),
      );
    }

    const dataToSave: SigWrite = {};

    if (description !== undefined) {
      if (typeof description !== "string")
        throw new CustomError(
          CustomStatus.INVALID_BODY,
          new Error("Invalid description"),
        );
      if (description.length > DESCRIPTION_MAX_LENGTH)
        throw new CustomError(
          CustomStatus.INVALID_CONTENT_LENGTH,
          new Error("Invalid description"),
        );
      dataToSave.description = description;
    }

    // An image id from POST /image
    if (avatar !== undefined) {
      if (
        typeof avatar !== "string" ||
        !isValidObjectId(avatar) ||
        !(await AdminDB.imageExists(avatar))
      )
        throw new CustomError(
          CustomStatus.INVALID_IMAGE_ID,
          new Error("Invalid avatar image id"),
        );
      dataToSave.avatar = avatar;
    }

    if (name !== undefined) {
      if (typeof name !== "string")
        throw new CustomError(
          CustomStatus.INVALID_BODY,
          new Error("Invalid name"),
        );
      const newName = name.trim();
      const length = Array.from(newName).length;
      if (length < 1 || length > NAME_MAX_LENGTH)
        throw new CustomError(
          CustomStatus.INVALID_CONTENT_LENGTH,
          new Error("Invalid name"),
        );
      dataToSave.name = newName;
    }

    const savedData = await SigDB.write(dataToSave, { id: sigId });

    await recordAudit({
      actor: userId,
      action: "sig.update",
      target: { kind: "sig", id: sigId, label: savedData.name ?? "" },
      meta: { fields: Object.keys(dataToSave) },
    });

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
