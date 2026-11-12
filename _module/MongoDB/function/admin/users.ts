import { isValidObjectId } from "mongoose";

import { Filter } from "@type/database";
import user from "@schema/user";
import post from "@schema/post";
import comment from "@schema/comment";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { ADMIN_PERMISSION } from "@module/Permission";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

const LIST_FIELDS = {
  name: 1,
  customId: 1,
  email: 1,
  code: 1,
  class: 1,
  identity: 1,
  avatar: 1,
  permission: 1,
  badge: 1,
  sig: 1,
  suspension: 1,
  createdAt: 1,
} as const;

/** Number of users with each badge key (GET /admin/badges). */
export async function badgeUserCounts() {
  try {
    const counts: Record<string, number> = {};
    const groups: { _id: string; count: number }[] = await user.aggregate([
      { $match: { "badge.0": { $exists: true } } },
      { $project: { badge: { $setUnion: ["$badge", []] } } },
      { $unwind: "$badge" },
      { $group: { _id: "$badge", count: { $sum: 1 } } },
    ]);
    for (const group of groups) counts[String(group._id)] = group.count;
    return counts;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/** One page of users (newest first) and the total for the same filter. */
export async function listUsers(
  filter: Filter,
  option: { skip: number; limit: number },
) {
  try {
    const [data, total] = await Promise.all([
      user
        .find(filter, LIST_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .skip(option.skip)
        .limit(option.limit)
        .lean(),
      user.countDocuments(filter),
    ]);
    return { data: data as any[], total };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/** The full user (as GET /user/:id/full returns it), or null. */
export async function readFullUser(id: string) {
  try {
    const doc = await user.findById(id).lean();
    return doc ? (leanDefaults(user, doc) as any) : null;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/**
 * The user's non-removed posts and comments, the SIGs they lead or moderate
 * and the SIGs of their memberships (removed SIGs included: this is their
 * record, and `sig` in the user document lists them too).
 */
export async function userActivity(id: string, memberSigIds: string[]) {
  try {
    const [postCount, commentCount, managed, memberSigs] = await Promise.all([
      post.countDocuments({ user: id, removed: false }),
      comment.countDocuments({ user: id, removed: false }),
      sig
        .find(
          { $or: [{ leader: id }, { moderator: id }] },
          { name: 1, leader: 1, moderator: 1 },
        )
        .sort({ _id: 1 })
        .lean(),
      sig
        .find(
          {
            _id: {
              $in: memberSigIds.filter((sigId) => isValidObjectId(sigId)),
            },
          },
          { name: 1 },
        )
        .sort({ _id: 1 })
        .lean(),
    ]);
    return {
      postCount,
      commentCount,
      managed: managed as any[],
      memberSigs: memberSigs as any[],
    };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

export async function countAdmins() {
  try {
    return await user.countDocuments({ permission: ADMIN_PERMISSION });
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/**
 * Sets the permission. Returns the user before the change, or null when no
 * user with that id has `from` (any permission other than `permission` when
 * `from` is omitted).
 */
export async function setPermission(
  id: string,
  permission: number,
  from?: number,
) {
  try {
    return (await user
      .findOneAndUpdate(
        {
          _id: id,
          permission: from === undefined ? { $ne: permission } : from,
        },
        { $set: { permission } },
        {
          returnDocument: "before",
          projection: { name: 1, permission: 1 },
        },
      )
      .lean()) as any;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
  }
}

/** Replaces the badges. Returns the user before the change, or null. */
export async function setBadges(id: string, badges: string[]) {
  try {
    return (await user
      .findOneAndUpdate(
        { _id: id },
        { $set: { badge: badges } },
        { returnDocument: "before", projection: { name: 1, badge: 1 } },
      )
      .lean()) as any;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
  }
}

/**
 * Removes `sigId` from the user's SIGs. Returns the user (name only) when
 * they were a member, otherwise null.
 */
export async function removeSigMembership(userId: string, sigId: string) {
  try {
    return (await user
      .findOneAndUpdate(
        { _id: userId, sig: sigId },
        { $pull: { sig: sigId } },
        { returnDocument: "after", projection: { name: 1 } },
      )
      .lean()) as any;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
  }
}

const PROFILE_FIELDS = {
  name: 1,
  customId: 1,
  previousCustomIds: 1,
  displayName: 1,
  description: 1,
} as const;

/** The fields an admin edits (POST /admin/users/:id), or null. */
export async function readUserProfile(id: string) {
  try {
    return (await user.findById(id, PROFILE_FIELDS).lean()) as any;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/**
 * Sets profile fields while the user still has `customId`. Returns the
 * user after the change, or null when the customId changed meanwhile or the
 * new one is taken (duplicate key).
 */
export async function updateUserProfile(
  id: string,
  set: Record<string, unknown>,
  customId: string | undefined,
) {
  try {
    return (await user
      .findOneAndUpdate(
        { _id: id, customId: customId ?? null },
        { $set: set },
        { returnDocument: "after", projection: PROFILE_FIELDS },
      )
      .lean()) as any;
  } catch (error: any) {
    if (error?.code === 11000) return null;
    throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
  }
}
