import { SortOrder } from "mongoose";

import { Filter } from "@type/database";
import post from "@schema/post";
import user from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const LIST_FIELDS = {
  title: 1,
  sig: 1,
  user: 1,
  createdAt: 1,
  updatedAt: 1,
  pinned: 1,
  removed: 1,
  likes: 1,
} as const;

const FLAG_FIELDS = { title: 1, sig: 1, pinned: 1, removed: 1 } as const;

export type PostFlag = "pinned" | "removed";

/** One page of posts (only the admin table fields) and the total. */
export async function listPosts(
  filter: Filter,
  option: { skip: number; limit: number; sort: Record<string, SortOrder> },
) {
  try {
    const [data, total] = await Promise.all([
      post
        .find(filter, LIST_FIELDS)
        .sort(option.sort)
        .skip(option.skip)
        .limit(option.limit)
        .lean(),
      post.countDocuments(filter),
    ]);
    return { data: data as any[], total };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}

/** Ids of the users whose name or customId matches `pattern`. */
export async function userIdsMatching(pattern: {
  $regex: string;
  $options: string;
}) {
  try {
    const users = await user
      .find({ $or: [{ name: pattern }, { customId: pattern }] }, { _id: 1 })
      .lean();
    return users.map((item) => String(item._id));
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/**
 * Sets `pinned` or `removed` on a post. `changed` is the updated post when
 * the flag was different before, `current` is the post as it is now (null
 * when there is no such post). A moderation change is not an edit, so
 * `updatedAt` is left alone. Documents missing the flag count as false.
 */
export async function setPostFlag(id: string, flag: PostFlag, value: boolean) {
  try {
    const changed = await post
      .findOneAndUpdate(
        { _id: id, [flag]: value ? { $ne: true } : true },
        { $set: { [flag]: value } },
        { returnDocument: "after", projection: FLAG_FIELDS, timestamps: false },
      )
      .lean();
    if (changed) return { changed: changed as any, current: changed as any };

    const current = await post.findById(id, FLAG_FIELDS).lean();
    return { changed: null, current: current as any };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_POST_TO_DB, error);
  }
}
