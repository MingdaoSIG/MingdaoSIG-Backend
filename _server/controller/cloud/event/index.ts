import { NextFunction, Request, RequestHandler, Response } from "express";
import { isValidObjectId } from "mongoose";

import { Sig } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import {
  ANNOUNCEMENT_SIG_ID,
  canManageSig,
  isAdmin,
  isSigModerator,
} from "@module/Permission";
import { notify } from "@module/Notify";
import { userIdFromJwt } from "@module/OptionalJwt";
import { buildCalendar, ICS_CONTENT_TYPE, IcsEvent } from "@module/Ics";
import { sigColorOf } from "@module/SigView";
import { userSigIds } from "@module/UserSigs";
import JWTverifier from "@middleware/JWTverifier";
import {
  EVENT_CAPACITY_MAX,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  EventDoc,
  EventModel,
  EventRsvpModel,
  isPast,
  readEvent,
  toEventItems,
} from "@module/SigEvent";
import {
  caller,
  callerId,
  fail,
  pagination,
  pathId,
  queryEnum,
  sendError,
} from "@controller/cloud/admin/_shared";

// SIG events, RSVPs and calendar feeds (API contract v4 §3.3).

const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();
const AdminDB = new MongoDB.Admin();

const EVENT_FIELDS = [
  "title",
  "description",
  "location",
  "startAt",
  "endAt",
  "capacity",
  "rsvpOpen",
] as const;
const REQUIRED_ON_CREATE = ["title", "startAt", "endAt"] as const;
const WHEN = ["upcoming", "past", "all"] as const;
const SCOPES = ["all", "mine", "rsvped"] as const;
const SIGNED_IN_SCOPES: readonly unknown[] = ["mine", "rsvped"];
const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_DEFAULT_DAYS = 60;
const LIST_MAX_DAYS = 120;
const CALENDAR_PAST_DAYS = 30;
const CALENDAR_MAX_EVENTS = 500;
const UID_DOMAIN = "sig.mingdao.edu.tw";

type EventFields = {
  title?: string;
  description?: string;
  location?: string;
  startAt?: Date;
  endAt?: Date;
  capacity?: number;
  rsvpOpen?: boolean;
};

/**
 * The user id of a valid `Authorization: Bearer <JWT>`, or null. Public
 * routes use it to add `rsvpedByMe`; an invalid token counts as none.
 */
function optionalUserId(req: Request): string | null {
  const id = userIdFromJwt(req);
  return id && isValidObjectId(id) ? id : null;
}

function text(value: unknown, name: string, max: number, required: boolean) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${name} must be a string`);
  const trimmed = value.trim();
  if (required && trimmed === "")
    fail(CustomStatus.EMPTY_CONTENT, `${name} is empty`);
  if (Array.from(trimmed).length > max)
    fail(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `${name} is longer than ${max} characters`,
    );
  return trimmed;
}

function date(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim() === "")
    fail(CustomStatus.INVALID_BODY, `${name} must be an ISO date string`);
  const parsed = new Date(value);
  const year = parsed.getUTCFullYear();
  if (Number.isNaN(parsed.getTime()) || year < 2000 || year > 2100)
    fail(CustomStatus.INVALID_BODY, `${name} is not a valid date`);
  return parsed;
}

/** The event fields in the body; on create, title, startAt and endAt. */
function parseEventBody(req: Request, mode: "create" | "edit") {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");
  const keys = Object.keys(body);
  if (keys.length === 0) fail(CustomStatus.INVALID_BODY, "Body is empty");
  const extra = keys.filter(
    (key) => !(EVENT_FIELDS as readonly string[]).includes(key),
  );
  if (extra.length > 0)
    fail(
      CustomStatus.INVALID_BODY,
      `Only these fields are allowed: ${EVENT_FIELDS.join(", ")}`,
    );
  if (mode === "create") {
    const missing = REQUIRED_ON_CREATE.filter((key) => body[key] === undefined);
    if (missing.length > 0)
      fail(CustomStatus.INVALID_BODY, `Missing: ${missing.join(", ")}`);
  }

  const data: EventFields = {};
  if (body.title !== undefined)
    data.title = text(body.title, "title", EVENT_TITLE_MAX_LENGTH, true);
  if (body.description !== undefined)
    data.description = text(
      body.description,
      "description",
      EVENT_DESCRIPTION_MAX_LENGTH,
      false,
    );
  if (body.location !== undefined)
    data.location = text(
      body.location,
      "location",
      EVENT_LOCATION_MAX_LENGTH,
      false,
    );
  if (body.startAt !== undefined) data.startAt = date(body.startAt, "startAt");
  if (body.endAt !== undefined) data.endAt = date(body.endAt, "endAt");
  if (body.capacity !== undefined) {
    const capacity = body.capacity;
    if (
      !Number.isInteger(capacity) ||
      capacity < 0 ||
      capacity > EVENT_CAPACITY_MAX
    )
      fail(
        CustomStatus.INVALID_BODY,
        `capacity must be an integer from 0 to ${EVENT_CAPACITY_MAX}`,
      );
    data.capacity = capacity;
  }
  if (body.rsvpOpen !== undefined) {
    if (typeof body.rsvpOpen !== "boolean")
      fail(CustomStatus.INVALID_BODY, "rsvpOpen must be a boolean");
    data.rsvpOpen = body.rsvpOpen;
  }
  return data;
}

function checkTimes(startAt: Date, endAt: Date) {
  if (endAt.getTime() < startAt.getTime())
    fail(CustomStatus.INVALID_BODY, "endAt is before startAt");
}

/**
 * Managers (leaders, moderators) of the SIG or an admin. An archived
 * (removed) SIG is left to its moderators and admins, like POST /sig/:id.
 */
function assertCanManage(req: Request, sigData: Sig | null) {
  const user = caller(req);
  if (!sigData || !canManageSig(user, sigData))
    fail(CustomStatus.FORBIDDEN, "Not admin or manager of this sig");
  if (
    sigData.removed &&
    !isAdmin(user) &&
    !isSigModerator(sigData, callerId(req))
  )
    fail(CustomStatus.FORBIDDEN, "Sig removed");
}

async function readSig(sigId: string) {
  return (await SigDB.read({ id: sigId }).catch(() => null)) as Sig | null;
}

async function readEventOr404(req: Request) {
  const event = await readEvent(pathId(req, "id"));
  if (!event) fail(CustomStatus.NOT_FOUND, "Event not found");
  return event;
}

function sigLink(sigData: Pick<Sig, "_id" | "customId">) {
  return `/@${sigData.customId || String(sigData._id)}?tab=events`;
}

/** Notifies every member of the SIG (users whose `sig` contains it). */
async function notifyMembers(sigData: Sig, event: EventDoc, actor: string) {
  const sigId = String(sigData._id);
  const members = await UserDB.list(
    { sig: sigId },
    { lean: true, projection: { _id: 1 } },
  );
  await notify(
    members.map((member) => ({
      recipient: String(member._id),
      type: "event" as const,
      actor,
      target: {
        kind: "event" as const,
        id: String(event._id),
        label: event.title,
      },
      link: sigLink(sigData),
      meta: { sig: sigId, sigName: sigData.name ?? "", startAt: event.startAt },
    })),
  );
}

// GET /sig/:sigId/events?when=upcoming|past|all&skip&limit (public)
export const listSigEvents: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = pathId(req, "sigId");
    const when = queryEnum(req, "when", WHEN, "upcoming");
    const { skip, limit } = pagination(req);
    if (!(await readSig(sigId))) fail(CustomStatus.NOT_FOUND, "Sig not found");

    const now = new Date();
    const filter: Record<string, unknown> = { sig: sigId, removed: false };
    if (when === "upcoming") filter.endAt = { $gte: now };
    if (when === "past") filter.endAt = { $lt: now };
    const order = when === "upcoming" ? 1 : -1;

    const [docs, total] = await Promise.all([
      EventModel.find(filter)
        .sort({ startAt: order, _id: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventModel.countDocuments(filter),
    ]);
    const data = await toEventItems(docs as EventDoc[], optionalUserId(req));
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data, total });
  } catch (error) {
    return sendError(res, error);
  }
};

/** An optional ISO date query value; anything unparsable is 404/4012. */
function queryDate(req: Request, name: string) {
  const value = req.query[name];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_QUERY, `${name} is not a single string`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    fail(CustomStatus.INVALID_QUERY, `${name} is not an ISO date`);
  return parsed;
}

/**
 * The `from`/`to` window of GET /event/list: from defaults to now, to to
 * from + 60 days; at most 120 days, and to may not be before from.
 */
function listWindow(req: Request) {
  const from = queryDate(req, "from") ?? new Date();
  const to =
    queryDate(req, "to") ??
    new Date(from.getTime() + LIST_DEFAULT_DAYS * DAY_MS);
  if (to.getTime() < from.getTime())
    fail(CustomStatus.INVALID_QUERY, "to is before from");
  if (to.getTime() - from.getTime() > LIST_MAX_DAYS * DAY_MS)
    fail(
      CustomStatus.INVALID_QUERY,
      `from and to may be at most ${LIST_MAX_DAYS} days apart`,
    );
  return { from, to };
}

/**
 * For GET /event/list: `scope=mine` and `scope=rsvped` need a valid JWT
 * (401/4013 otherwise); `all` (the default) is public.
 */
export function eventListAuth(req: Request, res: Response, next: NextFunction) {
  if (SIGNED_IN_SCOPES.includes(req.query.scope)) {
    return JWTverifier(req, res, next);
  }
  return next();
}

type ListSig = {
  _id: unknown;
  name?: string;
  customId?: string;
  color?: string;
  removed?: boolean;
};

// GET /event/list?scope=all|mine|rsvped&from&to&skip&limit (API contract v4
// §6.4): events of every SIG (all, public), of the caller's member, managed
// and followed SIGs (mine) or that the caller signed up for (rsvped), that
// overlap the window (end at or after from, start before to), by startAt.
// Events of archived SIGs (except the announcement SIG) are left out of all
// and mine. Items are the §3.3 items with `sig: { _id, name, customId,
// color }`.
export const listEvents: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const scope = queryEnum(req, "scope", SCOPES, "all");
    const { from, to } = listWindow(req);
    const { skip, limit } = pagination(req);
    const viewerId = scope === "all" ? optionalUserId(req) : callerId(req);

    const sigs = (await SigDB.list(
      {},
      {
        lean: true,
        projection: { name: 1, customId: 1, color: 1, removed: 1 },
      },
    )) as unknown as ListSig[];
    const sigById = new Map(sigs.map((item) => [String(item._id), item]));
    const archived = sigs
      .filter(
        (item) => item.removed && String(item._id) !== ANNOUNCEMENT_SIG_ID,
      )
      .map((item) => String(item._id));

    const filter: Record<string, unknown> = {
      removed: false,
      startAt: { $lt: to },
      endAt: { $gte: from },
    };
    if (scope === "all") {
      filter.sig = { $nin: archived };
    } else if (scope === "mine") {
      const user = caller(req);
      const mine = await userSigIds(String(user._id), user.sig ?? [], {
        followed: true,
      });
      filter.sig = { $in: mine.filter((id) => !archived.includes(id)) };
    } else {
      const rsvps = await EventRsvpModel.find(
        { user: viewerId },
        { event: 1 },
      ).lean();
      filter._id = {
        $in: rsvps
          .map((item: any) => String(item.event))
          .filter((id) => isValidObjectId(id)),
      };
    }

    const [docs, total] = await Promise.all([
      EventModel.find(filter)
        .sort({ startAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventModel.countDocuments(filter),
    ]);
    const items = await toEventItems(docs as EventDoc[], viewerId);
    const data = items.map((item) => {
      const sigData = sigById.get(item.sig);
      return {
        ...item,
        sig: {
          _id: item.sig,
          name: sigData?.name ?? "",
          customId: sigData?.customId ?? "",
          color: sigColorOf(sigData),
        },
      };
    });

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data, total });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /sig/:sigId/events (the SIG's managers or an admin)
export const createSigEvent: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = pathId(req, "sigId");
    const sigData = await readSig(sigId);
    if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");
    assertCanManage(req, sigData);

    const data = parseEventBody(req, "create");
    checkTimes(data.startAt as Date, data.endAt as Date);

    const actor = callerId(req);
    const created = await EventModel.create({
      ...data,
      sig: sigId,
      createdBy: actor,
    });
    const event = created.toObject() as EventDoc;

    notifyMembers(sigData, event, actor).catch((error) => {
      console.error(
        `Event : failed to notify the members of sig ${sigId}:`,
        error instanceof Error ? error.message : error,
      );
    });

    const [item] = await toEventItems([event], actor);
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: item });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /event/:id (public)
export const readEventById: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    const [item] = await toEventItems([event], optionalUserId(req));
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: item });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /event/:id (the SIG's managers or an admin): partial edit
export const editEvent: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    assertCanManage(req, await readSig(event.sig));

    const data = parseEventBody(req, "edit");
    checkTimes(
      data.startAt ?? new Date(event.startAt),
      data.endAt ?? new Date(event.endAt),
    );

    const updated = (await EventModel.findOneAndUpdate(
      { _id: event._id, removed: false },
      { $set: data },
      { returnDocument: "after", lean: true },
    )) as EventDoc | null;
    if (!updated) fail(CustomStatus.NOT_FOUND, "Event not found");

    const [item] = await toEventItems([updated], callerId(req));
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: item });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /event/:id (the SIG's managers or an admin): soft remove
export const removeEvent: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    assertCanManage(req, await readSig(event.sig));

    const updated = await EventModel.findOneAndUpdate(
      { _id: event._id, removed: false },
      { $set: { removed: true } },
      { returnDocument: "after", lean: true },
    );
    if (!updated) fail(CustomStatus.NOT_FOUND, "Event not found");

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: String(event._id), removed: true },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /event/:id/rsvp (JWT). Idempotent: RSVPing again returns the event.
// New RSVPs are refused when RSVP is closed (4001), the event is over (4001)
// or full (4026).
export const rsvp: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    const eventId = String(event._id);
    const userId = callerId(req);

    const existing = await EventRsvpModel.exists({
      event: eventId,
      user: userId,
    });
    if (!existing) {
      if (!event.rsvpOpen) fail(CustomStatus.FORBIDDEN, "RSVP is closed");
      if (isPast(event)) fail(CustomStatus.FORBIDDEN, "Event is over");
      const capacity = event.capacity ?? 0;
      if (
        capacity > 0 &&
        (await EventRsvpModel.countDocuments({ event: eventId })) >= capacity
      )
        fail(CustomStatus.CONTENT_SIZE_EXCEEDED, "Event is full");

      let created: { _id: unknown } | null = null;
      try {
        created = await EventRsvpModel.create({ event: eventId, user: userId });
      } catch (error: any) {
        // The same user's parallel request won: already RSVPed.
        if (error?.code !== 11000) throw error;
      }
      // Two users racing for the last seats: whoever is past the capacity
      // (by insertion order) gives the seat back.
      if (created && capacity > 0) {
        const position = await EventRsvpModel.countDocuments({
          event: eventId,
          _id: { $lte: created._id },
        });
        if (position > capacity) {
          await EventRsvpModel.deleteOne({ _id: created._id });
          fail(CustomStatus.CONTENT_SIZE_EXCEEDED, "Event is full");
        }
      }
    }

    const [item] = await toEventItems([event], userId);
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: item });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /event/:id/rsvp (JWT): cancel; fine when there is none.
export const cancelRsvp: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    const userId = callerId(req);
    await EventRsvpModel.deleteOne({ event: String(event._id), user: userId });

    const [item] = await toEventItems([event], userId);
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: item });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /event/:id/rsvps?skip&limit (the SIG's managers or an admin), oldest
// first.
export const listRsvps: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    const sigData = await readSig(event.sig);
    if (!sigData || !canManageSig(caller(req), sigData))
      fail(CustomStatus.FORBIDDEN, "Not admin or manager of this sig");
    const { skip, limit } = pagination(req);

    const filter = { event: String(event._id) };
    const [rsvps, total] = await Promise.all([
      EventRsvpModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventRsvpModel.countDocuments(filter),
    ]);
    const users = await AdminDB.usersByIds(
      rsvps.map((item: any) => item.user),
      { name: 1, customId: 1, class: 1 },
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: rsvps.map((item: any) => {
        const user = users.get(String(item.user));
        return {
          user: {
            _id: String(item.user),
            name: user?.name ?? "",
            customId: user?.customId ?? "",
            class: user?.class ?? "",
          },
          createdAt: item.createdAt,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

function toIcsEvent(event: EventDoc, sigData: Sig | null): IcsEvent {
  const frontend = (process.env.FRONTEND_BASE_URL ?? "").replace(/\/+$/, "");
  return {
    uid: `${String(event._id)}@${UID_DOMAIN}`,
    start: new Date(event.startAt),
    end: new Date(event.endAt),
    summary: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    url: frontend && sigData ? `${frontend}${sigLink(sigData)}` : undefined,
    created: event.createdAt ? new Date(event.createdAt) : undefined,
    lastModified: event.updatedAt ? new Date(event.updatedAt) : undefined,
  };
}

function sendIcs(res: Response, body: string, filename: string) {
  return res
    .status(HttpStatus.OK)
    .set("Content-Type", ICS_CONTENT_TYPE)
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .set("Cache-Control", "public, max-age=300")
    .send(body);
}

// GET /sig/:sigId/calendar.ics (public): upcoming events and those that
// ended in the last 30 days.
export const sigCalendar: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = pathId(req, "sigId");
    const sigData = await readSig(sigId);
    if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");

    const since = new Date(Date.now() - CALENDAR_PAST_DAYS * 86400000);
    const events = (await EventModel.find({
      sig: sigId,
      removed: false,
      endAt: { $gte: since },
    })
      .sort({ startAt: 1, _id: 1 })
      .limit(CALENDAR_MAX_EVENTS)
      .lean()) as EventDoc[];

    const body = buildCalendar(
      events.map((event) => toIcsEvent(event, sigData)),
      { name: `${sigData.name ?? ""} | MDSIG`.trim() },
    );
    return sendIcs(res, body, `sig-${sigId}.ics`);
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /event/:id.ics (public)
export const eventCalendar: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const event = await readEventOr404(req);
    const body = buildCalendar([toIcsEvent(event, await readSig(event.sig))]);
    return sendIcs(res, body, `event-${String(event._id)}.ics`);
  } catch (error) {
    return sendError(res, error);
  }
};
