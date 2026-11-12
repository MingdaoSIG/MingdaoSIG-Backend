import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import {
  ANNOUNCEMENT_SIG_ID,
  isAdmin,
  isSigLeader,
  isSigModerator,
} from "@module/Permission";
import { recordAudit } from "@module/Audit";
import { assertCustomIdAvailable } from "@module/CheckValidCustomId";
import {
  parseBoolean,
  parseImageId,
  parseJoinQuestions,
  parseRecruiting,
  parseSigColor,
  parseSigDescription,
  parseSigName,
  toSigResponse,
} from "@module/SigSettings";
import { parseFeaturedPosts } from "./showcase";
import { parseDiscordWebhook } from "./discord";

const SigDB = new MongoDB.Sig();

// Fields the SIG's managers (leaders, moderators) and admins may set.
const MANAGER_FIELDS = [
  "description",
  "avatar",
  "featuredPosts",
  "discordWebhook",
  "joinQuestions",
  "recruiting",
];
// Fields only an admin may set (API contract v4 §3.7).
const ADMIN_FIELDS = ["name", "customId", "color", "defaultCover", "removed"];

// POST /sig/:id: the SIG's leaders and moderators (advisors) or an admin.
// Body: any of MANAGER_FIELDS, and for an admin ADMIN_FIELDS too.
export const write: RequestHandler<Record<string, string>> = async (
  req: Request<Record<string, string>> | ExtendedRequest,
  res,
) => {
  try {
    const body = req.body ?? {};
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
      ...MANAGER_FIELDS,
      ...ADMIN_FIELDS,
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

    const adminOnly = ADMIN_FIELDS.filter((field) => body[field] !== undefined);
    if (adminOnly.length > 0 && !isAdminUser) {
      throw new CustomError(
        CustomStatus.FORBIDDEN,
        new Error(`Only an admin can change: ${adminOnly.join(", ")}`),
      );
    }

    const dataToSave: Record<string, unknown> = {};
    const auditMeta: Record<string, unknown> = {};

    if (body.description !== undefined)
      dataToSave.description = parseSigDescription(body.description);

    // An image id from POST /image
    if (body.avatar !== undefined)
      dataToSave.avatar = await parseImageId(body.avatar, "avatar");

    // Showcase (contract v4 §3.4)
    if (body.featuredPosts !== undefined)
      dataToSave.featuredPosts = await parseFeaturedPosts(
        body.featuredPosts,
        sigId,
      );

    // Discord announcements (contract v4 §3.6); never logged or returned
    if (body.discordWebhook !== undefined)
      dataToSave.discordWebhook = parseDiscordWebhook(body.discordWebhook);

    // Join questions and recruiting (contract v4 §5.6); null questions go
    // back to the three global ones.
    const unset: string[] = [];
    if (body.joinQuestions !== undefined) {
      const questions = parseJoinQuestions(body.joinQuestions);
      if (questions) dataToSave.joinQuestions = questions;
      else unset.push("joinQuestions");
    }

    if (body.recruiting !== undefined)
      dataToSave.recruiting = parseRecruiting(
        body.recruiting,
        sigData.recruiting,
      );

    // ---- Admin only (contract v4 §3.7) ----
    if (body.name !== undefined) dataToSave.name = parseSigName(body.name);

    if (body.color !== undefined) dataToSave.color = parseSigColor(body.color);

    if (body.defaultCover !== undefined)
      dataToSave.defaultCover = await parseImageId(
        body.defaultCover,
        "defaultCover",
      );

    if (body.removed !== undefined) {
      const removed = parseBoolean(body.removed, "removed");
      // Stored with removed: true on purpose and in use: "always archived
      // but active". Neither archiving nor unarchiving applies to it.
      if (sigId === ANNOUNCEMENT_SIG_ID)
        throw new CustomError(
          CustomStatus.FORBIDDEN,
          new Error("The announcement SIG cannot be archived or unarchived"),
        );
      if (removed !== Boolean(sigData.removed)) {
        dataToSave.removed = removed;
        auditMeta.removed = removed;
      }
    }

    // Unique across users and SIGs; the old id keeps redirecting.
    let guard: Record<string, unknown> = {};
    if (body.customId !== undefined && body.customId !== sigData.customId) {
      const next = await assertCustomIdAvailable(body.customId, {
        kind: "sig",
        id: sigId,
      });
      const previous = sigData.customId ?? "";
      dataToSave.customId = next;
      dataToSave.previousCustomIds = Array.from(
        new Set([
          ...(sigData.previousCustomIds ?? []).filter((id) => id !== next),
          ...(previous ? [previous] : []),
        ]),
      );
      auditMeta.from = previous;
      auditMeta.to = next;
      // Two renames at once: only the first one applies.
      guard = { customId: sigData.customId ?? null };
    }

    const fields = [
      ...Object.keys(dataToSave).filter(
        (field) => field !== "previousCustomIds",
      ),
      ...unset,
    ];
    const savedData =
      fields.length > 0
        ? await SigDB.update(sigId, dataToSave, guard, unset)
        : sigData;
    if (!savedData) {
      throw new CustomError(
        CustomStatus.CUSTOM_ID_ALREADY_EXISTS,
        new Error("The SIG's customId changed meanwhile"),
      );
    }

    if (fields.length > 0) {
      await recordAudit({
        actor: userId,
        action: "sig.update",
        target: { kind: "sig", id: sigId, label: savedData.name ?? "" },
        meta: { fields, ...auditMeta },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: toSigResponse(savedData),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
