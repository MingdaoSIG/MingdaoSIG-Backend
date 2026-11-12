import { isValidObjectId, Types } from "mongoose";

import post from "@schema/post";
import sig from "@schema/sig";
import user from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import EscapeRegExp from "@module/EscapeRegExp";
import toPublicUser, { PublicUser } from "@module/PublicUser";
import { activityOf, sigActivity } from "@module/SigActivity";
import { sigColorOf, sigRecruitingOf } from "@module/SigView";
import TTLCache from "@module/TTLCache";

/**
 * SIG and user sections of the unified search (API contract v4 §6.3). The
 * text is always matched literally (regex-escaped) and case-insensitively.
 * Matches rank exact first, then prefix, then any other substring.
 */

const EXACT = 0;
const PREFIX = 1;
const SUBSTRING = 2;
const NO_MATCH = 3;

const PARTICIPANT_CACHE_MS = 60 * 1000;

// Users who wrote a non-removed post or lead or advise a SIG (cached 60 s).
const participantCache = new TTLCache<Types.ObjectId[]>(
  PARTICIPANT_CACHE_MS,
  1,
);

function rankOf(text: unknown, needle: string) {
  if (typeof text !== "string") return NO_MATCH;
  const value = text.toLowerCase();
  if (value === needle) return EXACT;
  if (value.startsWith(needle)) return PREFIX;
  return value.includes(needle) ? SUBSTRING : NO_MATCH;
}

function compareText(a: unknown, b: unknown) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (x < y) return -1;
  return x > y ? 1 : 0;
}

export type SigSearchItem = {
  _id: string;
  name: string;
  customId: string;
  color: string;
  avatar: string;
  memberCount: number;
  recruiting: ReturnType<typeof sigRecruitingOf>;
};

/**
 * Non-archived SIGs whose name, customId or description contains `q`: name
 * matches first, then customId, then description (exact, prefix, substring
 * within each), then by name. At most `limit`.
 */
export async function searchSigs(
  q: string,
  limit: number,
): Promise<SigSearchItem[]> {
  const regex = { $regex: EscapeRegExp(q), $options: "i" };
  let docs: any[];
  let activity: Awaited<ReturnType<typeof sigActivity>>;
  try {
    [docs, activity] = await Promise.all([
      sig
        .find(
          {
            removed: false,
            $or: [{ name: regex }, { customId: regex }, { description: regex }],
          },
          {
            name: 1,
            customId: 1,
            description: 1,
            avatar: 1,
            color: 1,
            recruiting: 1,
          },
        )
        .lean(),
      sigActivity(),
    ]);
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }

  const needle = q.toLowerCase();
  const scored = docs.map((doc) => {
    const name = rankOf(doc.name, needle);
    const customId = rankOf(doc.customId, needle);
    const description = rankOf(doc.description, needle);
    // Field first (name, customId, description), then how well it matches.
    const score =
      name !== NO_MATCH
        ? name
        : customId !== NO_MATCH
          ? 10 + customId
          : 20 + Math.min(description, SUBSTRING);
    return { doc, score };
  });
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      compareText(a.doc.name, b.doc.name) ||
      compareText(a.doc._id, b.doc._id),
  );

  return scored.slice(0, limit).map(({ doc }) => ({
    _id: String(doc._id),
    name: doc.name ?? "",
    customId: doc.customId ?? "",
    color: sigColorOf(doc),
    avatar: doc.avatar ?? "",
    memberCount: activityOf(activity, doc._id).memberCount,
    recruiting: sigRecruitingOf(doc),
  }));
}

async function loadParticipants() {
  const [posters, sigs] = await Promise.all([
    post.distinct("user", { removed: false }),
    sig.find({}, { leader: 1, moderator: 1 }).lean(),
  ]);
  const ids = new Set<string>(posters.map(String));
  for (const doc of sigs as any[]) {
    for (const id of [...(doc.leader ?? []), ...(doc.moderator ?? [])])
      ids.add(String(id));
  }
  return Array.from(ids)
    .filter((id) => isValidObjectId(id))
    .map((id) => new Types.ObjectId(id));
}

/**
 * Users whose name or customId contains `q`, as their public fields (see
 * @module/PublicUser), with the total. Users with no post (non-removed) and
 * no SIG (membership, or leading or advising one) are left out. Exact
 * matches first, then prefix, then substring; then by name.
 */
export async function searchUsers(
  q: string,
  option: { skip: number; limit: number },
): Promise<{ data: PublicUser[]; total: number }> {
  try {
    const pattern = EscapeRegExp(q);
    const regex = { $regex: pattern, $options: "i" };
    const participants = await participantCache.getOrLoad(
      "all",
      loadParticipants,
    );

    const asString = (value: string) => ({
      $cond: [{ $eq: [{ $type: value }, "string"] }, value, ""],
    });
    const matches = (value: string, source: string) => ({
      $regexMatch: { input: asString(value), regex: source, options: "i" },
    });
    const either = (source: string) => ({
      $or: [matches("$name", source), matches("$customId", source)],
    });

    const [result] = await user.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ name: regex }, { customId: regex }] },
            {
              $or: [
                { "sig.0": { $exists: true } },
                { _id: { $in: participants } },
              ],
            },
          ],
        },
      },
      {
        $project: {
          customId: 1,
          name: 1,
          avatar: 1,
          description: 1,
          badge: 1,
          rank: {
            $cond: [
              either(`^${pattern}$`),
              EXACT,
              { $cond: [either(`^${pattern}`), PREFIX, SUBSTRING] },
            ],
          },
        },
      },
      {
        $facet: {
          page: [
            { $sort: { rank: 1, name: 1, _id: 1 } },
            { $skip: option.skip },
            { $limit: option.limit },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    return {
      data: (result?.page ?? []).map((doc: any) =>
        toPublicUser({ ...doc, _id: String(doc._id) }),
      ),
      total: result?.total?.[0]?.count ?? 0,
    };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}
