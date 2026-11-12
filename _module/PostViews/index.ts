import { createHash, randomBytes } from "node:crypto";
import { Request } from "express";
import mongoose from "mongoose";

import post from "@schema/post";
import { userIdFromJwt } from "@module/OptionalJwt";

/**
 * Post views (contract v4 §4.1).
 *
 * - `post.views` counts each viewer at most once per post per 6 hours.
 * - The viewer is the JWT user id, or else a salted hash of IP + user agent;
 *   raw IPs are never kept. The salt is random per process, so the hashes
 *   mean nothing outside it.
 * - Obvious bots, crawlers and scripts (by user agent) are not counted.
 * - The 6 h window lives in memory, which is fine for the single replica.
 * - Daily counts go to `post-view-daily` `{ post, date, count }`, keyed by
 *   the Asia/Taipei date and upserted.
 *
 * Collection: `post-view-daily`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const VIEW_WINDOW_MS = 6 * 60 * 60 * 1000;
// Upper bound on remembered (post, viewer) pairs; the oldest go first.
const MAX_TRACKED_VIEWS = 200_000;
// Taiwan has kept UTC+8 without daylight saving time since 1979.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const postViewDailySchema = new mongoose.Schema({
  post: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD, Asia/Taipei
  count: { type: Number, default: 0 },
});

// One row per post and day; also serves the per-post date range reads.
postViewDailySchema.index({ post: 1, date: 1 }, { unique: true });

export const PostViewDailyModel =
  (mongoose.models["post-view-daily"] as mongoose.Model<any>) ??
  mongoose.model("post-view-daily", postViewDailySchema, "post-view-daily");

/** The Asia/Taipei calendar date of `ms` as YYYY-MM-DD. */
export function taipeiDate(ms: number = Date.now()) {
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Crawlers, link previews, monitors, headless browsers and HTTP libraries.
 * `node` and `undici` are server-side fetches (e.g. the frontend rendering
 * share metadata), not readers. A missing user agent is not a browser either.
 */
const BOT_USER_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|archiver|facebookexternalhit|facebookcatalog|embedly|bingpreview|headless|phantomjs|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python|httpie|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|^node$|scrapy|feedfetcher|mediapartners|apis-google|petalbot|ahrefs|semrush|mj12/i;

export function isBotUserAgent(userAgent: string | undefined) {
  const ua = (userAgent ?? "").trim();
  return ua === "" || BOT_USER_AGENT.test(ua);
}

const ANONYMOUS_SALT = randomBytes(16);

/** Who is viewing: `u:<userId>` or `a:<hash>`; null for a bot. */
export function viewerKey(req: Request): string | null {
  const userAgent = req.get("user-agent");
  if (isBotUserAgent(userAgent)) return null;

  const userId = userIdFromJwt(req);
  if (userId) return `u:${userId}`;

  const hash = createHash("sha256")
    .update(ANONYMOUS_SALT)
    .update(req.ip ?? "")
    .update("\n")
    .update(userAgent ?? "")
    .digest("base64url")
    .slice(0, 22);
  return `a:${hash}`;
}

/**
 * Remembers which (post, viewer) pairs were counted in the last window.
 * Every entry lives exactly `windowMs`, so the Map's insertion order is also
 * its expiry order and expired entries are swept from the front.
 */
class ViewWindow {
  private seen = new Map<string, number>();

  constructor(
    private windowMs: number,
    private maxEntries: number,
  ) {}

  /** True (and remembered) when `key` was not counted within the window. */
  claim(key: string, now: number) {
    for (const [oldKey, expiresAt] of this.seen) {
      if (expiresAt > now) break;
      this.seen.delete(oldKey);
    }

    const expiresAt = this.seen.get(key);
    if (expiresAt !== undefined && expiresAt > now) return false;

    this.seen.delete(key);
    this.seen.set(key, now + this.windowMs);
    if (this.seen.size > this.maxEntries) {
      this.seen.delete(this.seen.keys().next().value as string);
    }
    return true;
  }
}

const viewWindow = new ViewWindow(VIEW_WINDOW_MS, MAX_TRACKED_VIEWS);

/**
 * Counts a view of `postId` by the caller of `req` unless it is a bot or
 * was already counted within 6 h. Returns whether it counted. Never throws:
 * a failed write is logged and the read goes on.
 */
export async function recordView(postId: string, req: Request) {
  const viewer = viewerKey(req);
  if (!viewer) return false;

  const now = Date.now();
  if (!viewWindow.claim(`${postId}|${viewer}`, now)) return false;

  try {
    await Promise.all([
      // A view is not an edit: updatedAt (sitemap, excerpt cache) stays.
      post.updateOne(
        { _id: postId, removed: false },
        { $inc: { views: 1 } },
        { timestamps: false },
      ),
      PostViewDailyModel.updateOne(
        { post: postId, date: taipeiDate(now) },
        { $inc: { count: 1 } },
        { upsert: true },
      ),
    ]);
    return true;
  } catch (error) {
    console.error(
      `PostViews : failed to count a view of post ${postId}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** The `days` Asia/Taipei dates ending today, oldest first. */
export function recentTaipeiDates(days: number, now: number = Date.now()) {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    dates.push(taipeiDate(now - offset * DAY_MS));
  }
  return dates;
}

/**
 * Daily view rows of the given posts between two dates (inclusive), summed
 * per date and per post.
 */
export async function dailyViews(postIds: string[], from: string, to: string) {
  const byDate = new Map<string, number>();
  const byPost = new Map<string, number>();
  if (postIds.length === 0) return { byDate, byPost };

  const rows: { _id: { post: string; date: string }; count: number }[] =
    await PostViewDailyModel.aggregate([
      {
        $match: { post: { $in: postIds }, date: { $gte: from, $lte: to } },
      },
      {
        $group: {
          _id: { post: "$post", date: "$date" },
          count: { $sum: "$count" },
        },
      },
    ]);

  for (const { _id, count } of rows) {
    byDate.set(_id.date, (byDate.get(_id.date) ?? 0) + count);
    byPost.set(_id.post, (byPost.get(_id.post) ?? 0) + count);
  }
  return { byDate, byPost };
}
