import { isValidObjectId } from "mongoose";

import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { TOP_LEVEL_REPLY } from "./thread";

/**
 * Number of visible comments for each post, counted in MongoDB instead of
 * loading every comment: the non-removed top-level comments plus the
 * non-removed replies whose parent is a non-removed top-level comment of the
 * same post. That is exactly what GET /comment/list/post/:postId shows, so a
 * reply under a deleted comment stops counting (and counts again if the
 * comment is restored). Posts without comments are missing from the result.
 */
export default async function countByPost(postIds: string[]) {
  try {
    const counts: Record<string, number> = {};
    if (postIds.length === 0) return counts;

    // One group per (post, parent): a few rows per post at most.
    const groups: { _id: { post: string; reply: string }; count: number }[] =
      await comment.aggregate([
        { $match: { post: { $in: postIds }, removed: false } },
        {
          $group: {
            _id: { post: "$post", reply: { $ifNull: ["$reply", ""] } },
            count: { $sum: 1 },
          },
        },
      ]);

    const parentIds = Array.from(
      new Set(
        groups
          .map((group) => group._id.reply)
          .filter((id) => id !== "" && isValidObjectId(id)),
      ),
    );
    // Parent id -> its post, for the parents that still show.
    const visibleParents = new Map<string, string>();
    if (parentIds.length > 0) {
      const parents = await comment
        .find(
          {
            _id: { $in: parentIds },
            removed: false,
            reply: TOP_LEVEL_REPLY,
          },
          { post: 1 },
        )
        .lean();
      for (const parent of parents) {
        visibleParents.set(String(parent._id), String(parent.post));
      }
    }

    for (const group of groups) {
      const { post, reply } = group._id;
      const visible =
        reply === "" || visibleParents.get(String(reply)) === String(post);
      if (!visible) continue;
      counts[String(post)] = (counts[String(post)] ?? 0) + group.count;
    }

    return counts;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
  }
}
