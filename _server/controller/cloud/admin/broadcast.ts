import { RequestHandler } from "express";
import mongoose, { isValidObjectId } from "mongoose";

import { Filter } from "@type/database";
import user from "@schema/user";
import sig from "@schema/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { canManageSig, isAdmin } from "@module/Permission";
import { AuditModel, recordAudit } from "@module/Audit";
import { insertNotifications } from "@module/Notify";
import { dispatchPushMany } from "@module/WebPush";
import { boundedString, linkValue, objectBody, storedId } from "../_body";
import { caller, fail, sendError } from "./_shared";

// Broadcast notifications (廣播通知, contract v4 §5.5). Admins may send to
// everyone or to one SIG; SIG managers only to the SIGs they manage.

const TITLE_MAX = 60;
const MESSAGE_MAX = 300;
const DEFAULT_LINK = "/notifications";

// At most this many broadcasts per sender per hour (4290 above it), counted
// from the audit log, so the limit survives a restart.
const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

// One broadcast at a time per sender (the backend runs one replica): each
// one counts the earlier ones only after they are audited, so concurrent
// requests cannot both take the last slot.
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(sender: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(sender) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  queues.set(sender, tail);
  tail.then(() => {
    if (queues.get(sender) === tail) queues.delete(sender);
  });
  return run;
}

type Audience = { type: "all" } | { type: "sig"; sig: string };

function parseAudience(value: unknown): Audience {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, "audience must be an object");
  const { type, ...rest } = value as Record<string, unknown>;
  if (type === "all" && Object.keys(rest).length === 0) return { type: "all" };
  if (type === "sig" && Object.keys(rest).length === 1 && "sig" in rest)
    return { type: "sig", sig: storedId(rest.sig, "audience.sig") };
  fail(
    CustomStatus.INVALID_BODY,
    'audience must be { type: "all" } or { type: "sig", sig }',
  );
}

/**
 * Who gets it: every user, or the SIG's members (users whose `sig` lists
 * it) plus its leaders and moderators. The sender is never included.
 */
function audienceFilter(audience: Audience, sigDoc: any, sender: string) {
  const exceptSender: Filter = { _id: { $ne: sender } };
  if (audience.type === "all") return exceptSender;

  const managers = [...(sigDoc.leader ?? []), ...(sigDoc.moderator ?? [])]
    .map(String)
    .filter((id) => isValidObjectId(id));
  return {
    $and: [
      exceptSender,
      { $or: [{ sig: audience.sig }, { _id: { $in: managers } }] },
    ],
  };
}

async function sentInLastHour(sender: string) {
  return AuditModel.countDocuments({
    actor: sender,
    action: "broadcast.send",
    createdAt: { $gte: new Date(Date.now() - HOUR_MS) },
  });
}

/**
 * POST /admin/broadcast { audience, title, message, link?, push, dryRun? }
 * (admin; SIG managers for their own SIGs). Stores a `system` notification
 * for every recipient (insertMany), pushes it when `push` is true to the
 * recipients whose `notificationSettings.push.system` is not false, and
 * answers `{ recipients }`. `dryRun: true` only counts the recipients
 * (nothing is sent, audited or counted against the rate limit).
 */
export const broadcast: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(
      req,
      ["audience", "title", "message", "link", "push", "dryRun"],
      { required: ["audience", "title", "message", "push"] },
    );
    const audience = parseAudience(body.audience);
    const title = boundedString(body.title, "title", TITLE_MAX, {
      trim: true,
      min: 1,
    });
    const message = boundedString(body.message, "message", MESSAGE_MAX, {
      trim: true,
      min: 1,
    });
    const link = linkValue(body.link) || DEFAULT_LINK;
    if (typeof body.push !== "boolean")
      fail(CustomStatus.INVALID_BODY, "push must be true or false");
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean")
      fail(CustomStatus.INVALID_BODY, "dryRun must be true or false");
    const push = body.push;
    const dryRun = body.dryRun === true;

    const sender = caller(req);
    const senderId = String(sender._id);
    let sigDoc: any = null;
    if (audience.type === "sig") {
      sigDoc = await sig
        .findById(audience.sig, { name: 1, leader: 1, moderator: 1 })
        .lean();
      if (!sigDoc) fail(CustomStatus.NOT_FOUND, "SIG not found");
    }
    if (!isAdmin(sender) && !(sigDoc && canManageSig(sender, sigDoc)))
      fail(
        CustomStatus.FORBIDDEN,
        audience.type === "all"
          ? "Only admins can broadcast to everyone"
          : "You do not manage this SIG",
      );

    const filter = audienceFilter(audience, sigDoc, senderId);
    if (dryRun) {
      const recipients = await user.countDocuments(filter);
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: { recipients, dryRun: true },
      });
    }

    const recipients = await oneAtATime(senderId, async () => {
      if ((await sentInLastHour(senderId)) >= MAX_PER_HOUR)
        fail(
          CustomStatus.TOO_MANY_REQUESTS,
          `At most ${MAX_PER_HOUR} broadcasts per hour`,
        );
      return send({
        audience,
        sigDoc,
        filter,
        senderId,
        title,
        message,
        link,
        push,
      });
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { recipients },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/** Stores, audits and (optionally) pushes; returns the recipient count. */
async function send(input: {
  audience: Audience;
  sigDoc: any;
  filter: Filter;
  senderId: string;
  title: string;
  message: string;
  link: string;
  push: boolean;
}) {
  const { audience, sigDoc, filter, senderId, title, message, link, push } =
    input;
  const broadcastId = String(new mongoose.Types.ObjectId());
  const audienceMeta =
    audience.type === "all"
      ? { type: "all" as const }
      : { type: "sig" as const, sig: audience.sig };
  const recipientIds = (
    await user.find(filter, { _id: 1 }).lean<{ _id: unknown }[]>()
  ).map((doc) => String(doc._id));

  const stored = await insertNotifications(
    recipientIds.map((recipient) => ({
      recipient,
      type: "system" as const,
      actor: senderId,
      target: { kind: "broadcast" as const, id: broadcastId, label: title },
      link,
      meta: {
        title,
        message,
        audience: sigDoc
          ? { ...audienceMeta, sigName: sigDoc.name ?? "" }
          : audienceMeta,
      },
    })),
  );
  const recipients = stored.length;

  await recordAudit({
    actor: senderId,
    action: "broadcast.send",
    target: { kind: "broadcast", id: broadcastId, label: title },
    meta: { audience: audienceMeta, recipients, push },
  });

  if (push) {
    dispatchPushMany(stored).catch((error) =>
      console.error(
        "Broadcast : push failed:",
        error instanceof Error ? error.message : error,
      ),
    );
  }
  return recipients;
}
