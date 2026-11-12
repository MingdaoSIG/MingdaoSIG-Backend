import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { canManageSig } from "@module/Permission";
import { recordAudit } from "@module/Audit";
import {
  caller,
  callerId,
  fail,
  pathId,
  sendError,
} from "@controller/cloud/admin/_shared";

const SigDB = new MongoDB.Sig();
const AdminDB = new MongoDB.Admin();

// DELETE /sig/:sigId/members/:userId: removes the SIG from the user's `sig`
// list. Allowed for an admin, the SIG's managers, or the user themself
// (`:userId` is their id or `me`: leaving the SIG).
export const removeMember: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = pathId(req, "sigId");
    const actor = callerId(req);
    const userId = req.params.userId === "me" ? actor : req.params.userId;
    if (!isValidObjectId(userId))
      fail(CustomStatus.NOT_FOUND, "Invalid userId");

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");

    const self = userId === actor;
    if (!self && !canManageSig(caller(req), sigData))
      fail(CustomStatus.FORBIDDEN, "Not admin or manager of this sig");

    const member = await AdminDB.removeSigMembership(userId, sigId);
    if (!member) {
      const user = await AdminDB.usersByIds([userId], { _id: 1 });
      if (!user.has(userId)) fail(CustomStatus.NOT_FOUND, "User not found");
      fail(CustomStatus.NOT_A_MEMBER, "Not a member");
    }

    if (!self) {
      await recordAudit({
        actor,
        action: "sig.member.remove",
        target: { kind: "user", id: userId, label: member.name ?? "" },
        meta: { sig: sigId },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { sig: sigId, user: userId },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
