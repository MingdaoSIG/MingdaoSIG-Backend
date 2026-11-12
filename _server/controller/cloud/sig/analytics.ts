import { RequestHandler } from "express";

import post from "@schema/post";
import user from "@schema/user";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import TTLCache from "@module/TTLCache";
import { canManageSig } from "@module/Permission";
import { EventModel, EventRsvpModel } from "@module/SigEvent";
import {
  caller,
  fail,
  pathId,
  sendError,
} from "@controller/cloud/admin/_shared";

const SigDB = new MongoDB.Sig();
const CommentDB = new MongoDB.Comment();
const AdminDB = new MongoDB.Admin();

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 24;
const TOP_LIMIT = 5;
const TIME_ZONE = "Asia/Taipei";
// Taiwan has no daylight saving time.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

const cache = new TTLCache<object>(10 * 60 * 1000, 500);

/** The last `months` months in Asia/Taipei ("YYYY-MM", oldest first). */
export function taipeiMonths(now: Date, months: number) {
  const local = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - i, 1));
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        "0",
      )}`,
    );
  }
  // 00:00 Asia/Taipei on the first day of the oldest month
  const start = new Date(
    Date.UTC(year, month - (months - 1), 1) - TAIPEI_OFFSET_MS,
  );
  return { keys, start };
}

function monthOf(field: string) {
  return {
    $dateToString: { format: "%Y-%m", date: field, timezone: TIME_ZONE },
  };
}

function parseMonths(value: unknown) {
  if (value === undefined) return DEFAULT_MONTHS;
  if (typeof value !== "string" || !/^\d+$/.test(value))
    fail(CustomStatus.INVALID_QUERY, "months must be an integer");
  const months = Number(value);
  if (months < 1 || months > MAX_MONTHS)
    fail(CustomStatus.INVALID_QUERY, `months must be from 1 to ${MAX_MONTHS}`);
  return months;
}

/**
 * The numbers for one SIG.
 *
 * - members.current: users with the SIG in `user.sig`.
 * - members.byMonth.joined: users whose join request was accepted in that
 *   month (the accepted request's `updatedAt`).
 * - posts.byMonth: non-removed posts created in that month; posts.total: all
 *   non-removed posts of the SIG.
 * - topPosts (by likes) and topAuthors (by posts): posts created in the
 *   window, at most 5 each.
 * - events: non-removed events, upcoming until they end; rsvps over them.
 */
async function computeAnalytics(sigId: string, months: number) {
  const now = new Date();
  const { keys, start } = taipeiMonths(now, months);
  const inWindow = { sig: sigId, removed: false, createdAt: { $gte: start } };

  try {
    const [
      current,
      joinedGroups,
      postGroups,
      postTotal,
      topPostDocs,
      authorGroups,
      eventDocs,
    ] = await Promise.all([
      user.countDocuments({ sig: sigId }),
      joinRequest.aggregate([
        {
          $match: {
            sig: sigId,
            state: "accepted",
            removed: false,
            updatedAt: { $gte: start },
          },
        },
        // A user accepted twice in a month joined once.
        { $group: { _id: { month: monthOf("$updatedAt"), user: "$user" } } },
        { $group: { _id: "$_id.month", joined: { $sum: 1 } } },
      ]),
      post.aggregate([
        { $match: inWindow },
        { $group: { _id: monthOf("$createdAt"), count: { $sum: 1 } } },
      ]),
      post.countDocuments({ sig: sigId, removed: false }),
      post
        .find(inWindow, { title: 1, likes: 1, views: 1 })
        .sort({ likes: -1, createdAt: -1, _id: -1 })
        .limit(TOP_LIMIT)
        .lean(),
      post.aggregate([
        { $match: inWindow },
        { $group: { _id: "$user", posts: { $sum: 1 } } },
        { $sort: { posts: -1, _id: 1 } },
        { $limit: TOP_LIMIT },
      ]),
      EventModel.find({ sig: sigId, removed: false }, { endAt: 1 }).lean(),
    ]);

    const topPostIds = topPostDocs.map((doc: any) => String(doc._id));
    const eventIds = eventDocs.map((doc: any) => String(doc._id));
    const [comments, authors, rsvps] = await Promise.all([
      CommentDB.countByPost(topPostIds),
      AdminDB.usersByIds(
        authorGroups.map((group: any) => group._id),
        { name: 1, customId: 1 },
      ),
      eventIds.length > 0
        ? EventRsvpModel.countDocuments({ event: { $in: eventIds } })
        : Promise.resolve(0),
    ]);

    const joinedBy = new Map<string, number>(
      joinedGroups.map((group: any) => [group._id, group.joined]),
    );
    const postsBy = new Map<string, number>(
      postGroups.map((group: any) => [group._id, group.count]),
    );
    const upcoming = eventDocs.filter(
      (doc: any) => new Date(doc.endAt).getTime() >= now.getTime(),
    ).length;

    return {
      members: {
        current,
        byMonth: keys.map((month) => ({
          month,
          joined: joinedBy.get(month) ?? 0,
        })),
      },
      posts: {
        byMonth: keys.map((month) => ({
          month,
          count: postsBy.get(month) ?? 0,
        })),
        total: postTotal,
      },
      topPosts: topPostDocs.map((doc: any) => ({
        _id: String(doc._id),
        title: doc.title ?? "",
        likes: doc.likes ?? 0,
        comments: comments[String(doc._id)] ?? 0,
        views: doc.views ?? 0,
      })),
      topAuthors: authorGroups.map((group: any) => {
        const author = authors.get(String(group._id));
        return {
          user: {
            _id: String(group._id),
            name: author?.name ?? "",
            customId: author?.customId ?? "",
          },
          posts: group.posts,
        };
      }),
      events: {
        upcoming,
        past: eventDocs.length - upcoming,
        rsvps,
      },
    };
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}

// GET /sig/:id/analytics?months=12 (the SIG's managers or an admin). Cached
// for 10 minutes per SIG and window.
export const analytics: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = pathId(req, "id");
    const months = parseMonths(req.query.months);
    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");
    if (!canManageSig(caller(req), sigData))
      fail(CustomStatus.FORBIDDEN, "Not admin or manager of this sig");

    const data = await cache.getOrLoad(`${sigId}:${months}`, () =>
      computeAnalytics(sigId, months),
    );
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};
