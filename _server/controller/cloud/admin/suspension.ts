import { RequestHandler } from "express";

import { Filter } from "@type/database";
import user from "@schema/user";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import {
  ADMIN_PERMISSION,
  CONTENT_MODERATOR_PERMISSION,
  isAdmin,
} from "@module/Permission";
import { recordAudit } from "@module/Audit";
import { notify } from "@module/Notify";
import {
  SUSPENSION_REASON_MAX,
  SUSPENSION_TYPES,
  Suspension,
  SuspensionType,
  activeSuspension,
  suspensionNotice,
  suspensionView,
} from "@module/Suspension";
import { boundedString } from "../_body";
import { caller, exactBody, fail, pathId, sendError } from "./_shared";

// 停權 / 禁言 (contract v4 §5.1). Admins may set both types; content
// moderators may only mute (and lift mutes). Nobody may suspend themself or
// an admin, and content moderators may not suspend each other.

const NOTICE_LINK = "/notifications";

function parseUntil(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, "until must be an ISO date or null");
  const until = new Date(value);
  if (Number.isNaN(until.getTime()))
    fail(CustomStatus.INVALID_BODY, "until must be an ISO date or null");
  if (until.getTime() <= Date.now())
    fail(CustomStatus.INVALID_BODY, "until must be in the future");
  return until;
}

async function readTarget(id: string) {
  const target: any = await user
    .findById(id, { name: 1, permission: 1, suspension: 1 })
    .lean();
  if (!target) fail(CustomStatus.NOT_FOUND, "User not found");
  return target;
}

/**
 * Refusals (403/4001): yourself; an admin (an admin may still lift an old
 * suspension of someone who became admin later); for a content moderator,
 * another content moderator.
 */
function checkTarget(
  actorId: string,
  actorIsAdmin: boolean,
  target: any,
  lifting: boolean,
) {
  if (String(target._id) === actorId)
    fail(CustomStatus.FORBIDDEN, "You cannot change your own suspension");
  if (isAdmin(target) && !(lifting && actorIsAdmin))
    fail(CustomStatus.FORBIDDEN, "An admin cannot be suspended");
  if (!actorIsAdmin && target.permission === CONTENT_MODERATOR_PERMISSION)
    fail(
      CustomStatus.FORBIDDEN,
      "Content moderators cannot suspend each other",
    );
}

/**
 * The update filter: the target as checked (still not an admin unless an
 * admin is lifting; for a content moderator, still not a content moderator
 * and without a ban in force), so a change in between refuses instead of
 * overriding it.
 */
function guardedFilter(
  id: string,
  actorIsAdmin: boolean,
  lifting: boolean,
): Filter {
  const filter: Filter = { _id: id };
  if (!(lifting && actorIsAdmin)) filter.permission = { $ne: ADMIN_PERMISSION };
  if (!actorIsAdmin) {
    filter.$and = [
      { permission: { $ne: CONTENT_MODERATOR_PERMISSION } },
      {
        $or: [
          { "suspension.type": { $ne: "ban" } },
          { "suspension.until": { $lte: new Date() } },
        ],
      },
    ];
  }
  return filter;
}

function notifySuspension(
  userId: string,
  suspension: Pick<Suspension, "type" | "until" | "reason">,
  lifted: boolean,
) {
  const notice = suspensionNotice(suspension, lifted);
  return notify({
    recipient: userId,
    type: "system",
    actor: null,
    target: { kind: "user", id: userId, label: notice.title },
    link: NOTICE_LINK,
    meta: {
      ...notice,
      suspension: lifted
        ? { type: suspension.type, lifted: true }
        : suspensionView(suspension as Suspension),
    },
  });
}

// POST /admin/users/:id/suspend { type, until, reason } (admin; content
// moderators: mute only)
export const suspend: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const body = exactBody(req, ["type", "until", "reason"]);
    if (!SUSPENSION_TYPES.includes(body.type as SuspensionType))
      fail(CustomStatus.INVALID_BODY, "type must be mute or ban");
    const type = body.type as SuspensionType;
    const until = parseUntil(body.until);
    const reason = boundedString(body.reason, "reason", SUSPENSION_REASON_MAX, {
      trim: true,
      min: 1,
    });

    const actorUser = caller(req);
    const actor = String(actorUser._id);
    const actorIsAdmin = isAdmin(actorUser);
    if (!actorIsAdmin && type !== "mute")
      fail(CustomStatus.FORBIDDEN, "Content moderators can only mute");

    const target = await readTarget(id);
    checkTarget(actor, actorIsAdmin, target, false);
    if (!actorIsAdmin && activeSuspension(target.suspension)?.type === "ban")
      fail(CustomStatus.FORBIDDEN, "Only an admin can change a ban");

    const suspension: Suspension = {
      type,
      until,
      reason,
      by: actor,
      createdAt: new Date(),
    };
    const result = await user.updateOne(
      guardedFilter(id, actorIsAdmin, false),
      {
        $set: { suspension },
      },
    );
    if (result.matchedCount === 0)
      fail(CustomStatus.FORBIDDEN, "The user changed meanwhile, try again");

    const view = suspensionView(suspension);
    await recordAudit({
      actor,
      action: "user.suspend",
      target: { kind: "user", id, label: target.name ?? "" },
      meta: view,
    });
    await notifySuspension(id, suspension, false);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: id,
        suspension: {
          ...view,
          by: actor,
          createdAt: suspension.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/users/:id/unsuspend (admin; content moderators: mutes only).
// Lifting a suspension that is not in force changes nothing.
export const unsuspend: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    if (req.body !== undefined) exactBody(req, []);

    const actorUser = caller(req);
    const actor = String(actorUser._id);
    const actorIsAdmin = isAdmin(actorUser);

    const target = await readTarget(id);
    checkTarget(actor, actorIsAdmin, target, true);
    const current = activeSuspension(target.suspension);
    if (!actorIsAdmin && current?.type === "ban")
      fail(CustomStatus.FORBIDDEN, "Only an admin can lift a ban");

    if (target.suspension) {
      const result = await user.updateOne(
        guardedFilter(id, actorIsAdmin, true),
        { $unset: { suspension: 1 } },
      );
      if (result.matchedCount === 0)
        fail(CustomStatus.FORBIDDEN, "The user changed meanwhile, try again");
    }

    if (current) {
      await recordAudit({
        actor,
        action: "user.unsuspend",
        target: { kind: "user", id, label: target.name ?? "" },
        meta: { type: current.type },
      });
      await notifySuspension(id, current, true);
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: id, suspension: null, lifted: Boolean(current) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
