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
  createdAt: 1,
} as const;

/** The values the user schema accepts in `badge`. */
export function badgeValues(): string[] {
  const path: any = user.schema.path("badge");
  return [...(path?.embeddedSchemaType?.enumValues ?? [])];
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
