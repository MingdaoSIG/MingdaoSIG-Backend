import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";
import { countUnread, listNotifications, markRead } from "@module/Notify";
import { callerId, fail, sendError } from "@controller/cloud/admin/_shared";

// The bell (contract v4 §2.1). Every route needs a JWT and only touches the
// caller's own notifications.

const UserDB = new MongoDB.User();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
// POST /notification/read takes at most one page of ids.
const MAX_READ_IDS = 100;

// GET /notification/list?skip&limit&unread=1
export const list: RequestHandler = async (req, res) => {
  try {
    CheckValidPaginationOption(req, MAX_LIMIT);
    const skip = req.query.skip === undefined ? 0 : Number(req.query.skip);
    const limit =
      req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);

    const { data, total, unread } = await listNotifications(callerId(req), {
      skip,
      limit,
      unreadOnly: unreadOnly(req),
    });
    const actors = await publicActors(data.map((item) => item.actor));

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((item) => {
        // meta.actors only de-duplicates collapsed notifications.
        const { actors: _actors, ...meta } = item.meta ?? {};
        return {
          _id: String(item._id),
          type: item.type,
          actor: (item.actor && actors.get(String(item.actor))) || null,
          target: {
            kind: item.target?.kind,
            id: item.target?.id,
            label: item.target?.label ?? "",
          },
          link: item.link,
          meta,
          read: Boolean(item.read),
          createdAt: item.createdAt,
        };
      }),
      total,
      unread,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /notification/unread-count
export const unreadCount: RequestHandler = async (req, res) => {
  try {
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { unread: await countUnread(callerId(req)) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /notification/read with { ids: [...] } or { all: true }
export const read: RequestHandler = async (req, res) => {
  try {
    const target = readTarget(req.body);
    const updated = await markRead(callerId(req), target);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { updated },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// `unread=1` (or true) lists only unread notifications; 0, false or no value
// lists all of them.
function unreadOnly(req: Request) {
  const value = req.query.unread;
  if (value === undefined || value === "" || value === "0" || value === "false")
    return false;
  if (value === "1" || value === "true") return true;
  return fail(CustomStatus.INVALID_QUERY, "unread must be 1 or 0");
}

function readTarget(body: unknown): string[] | "all" {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");

  const keys = Object.keys(body);
  if (keys.length !== 1)
    fail(CustomStatus.INVALID_BODY, "Body must be { ids } or { all: true }");

  const { ids, all } = body as { ids?: unknown; all?: unknown };
  if (keys[0] === "all") {
    if (all !== true) fail(CustomStatus.INVALID_BODY, "all must be true");
    return "all";
  }
  if (keys[0] !== "ids")
    fail(CustomStatus.INVALID_BODY, "Body must be { ids } or { all: true }");

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_READ_IDS ||
    !ids.every((id) => typeof id === "string" && isValidObjectId(id))
  )
    fail(
      CustomStatus.INVALID_BODY,
      `ids must be 1 to ${MAX_READ_IDS} notification ids`,
    );
  return ids as string[];
}

/** The public fields of each actor, by user id. */
async function publicActors(ids: unknown[]) {
  const unique = Array.from(
    new Set(
      ids
        .filter((id): id is string => typeof id === "string")
        .filter((id) => isValidObjectId(id)),
    ),
  );
  const actors = new Map<
    string,
    { _id: string; name: string; customId: string; avatar: string }
  >();
  if (unique.length === 0) return actors;

  const users = await UserDB.list(
    { _id: { $in: unique } },
    { lean: true, projection: { name: 1, customId: 1, avatar: 1 } },
  );
  for (const user of users) {
    actors.set(String(user._id), {
      _id: String(user._id),
      name: user.name ?? "",
      customId: user.customId ?? "",
      avatar: user.avatar ?? "",
    });
  }
  return actors;
}
