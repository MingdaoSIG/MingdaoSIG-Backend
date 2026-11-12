import post from "@schema/post";
import user from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import TTLCache from "@module/TTLCache";

/**
 * Per-SIG numbers for GET /sig/list, the SIG reads and the unified search
 * (API contract v4 §6.5):
 *
 * - `memberCount`: users with the SIG in `user.sig` (as the admin SIG list
 *   counts them);
 * - `latestPostAt`: `createdAt` of the SIG's newest non-removed post, or null.
 *
 * One aggregation computes both for every SIG, and its result is cached for
 * 60 s: a join, a leave or a new post shows up within a minute.
 */

export type SigActivity = { memberCount: number; latestPostAt: Date | null };

export const SIG_ACTIVITY_CACHE_MS = 60 * 1000;

const cache = new TTLCache<Map<string, SigActivity>>(SIG_ACTIVITY_CACHE_MS, 1);

const EMPTY: SigActivity = { memberCount: 0, latestPostAt: null };

/** The numbers of every SIG, keyed by SIG id (cached for 60 s). */
export function sigActivity() {
  return cache.getOrLoad("all", loadActivity);
}

/** The numbers of one SIG out of `sigActivity()`. */
export function activityOf(
  activity: Map<string, SigActivity>,
  sigId: unknown,
): SigActivity {
  return activity.get(String(sigId)) ?? EMPTY;
}

/** Drops the cached numbers, so the next read recomputes them. */
export function clearSigActivity() {
  cache.clear();
}

async function loadActivity() {
  try {
    // Newest post per SIG (the { sig, removed, createdAt } index), then the
    // members per SIG from the user collection in the same round trip.
    const rows: {
      _id: string;
      memberCount: number;
      latestPostAt: Date | null;
    }[] = await post.aggregate([
      { $match: { removed: false, sig: { $type: "string" } } },
      { $group: { _id: "$sig", latestPostAt: { $max: "$createdAt" } } },
      { $project: { _id: 1, latestPostAt: 1, memberCount: { $literal: 0 } } },
      {
        $unionWith: {
          coll: user.collection.collectionName,
          pipeline: [
            { $match: { "sig.0": { $exists: true } } },
            { $project: { sig: 1 } },
            { $unwind: "$sig" },
            // A user listing a SIG twice is still one member.
            { $group: { _id: { sig: "$sig", user: "$_id" } } },
            { $group: { _id: "$_id.sig", memberCount: { $sum: 1 } } },
            {
              $project: {
                _id: 1,
                memberCount: 1,
                latestPostAt: { $literal: null },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          memberCount: { $sum: "$memberCount" },
          latestPostAt: { $max: "$latestPostAt" },
        },
      },
    ]);

    const activity = new Map<string, SigActivity>();
    for (const row of rows) {
      activity.set(String(row._id), {
        memberCount: row.memberCount ?? 0,
        latestPostAt: row.latestPostAt ?? null,
      });
    }
    return activity;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
