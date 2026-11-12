import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

/**
 * Number of comments that are not removed (replies included) for each post,
 * counted in MongoDB instead of loading every comment. Posts without
 * comments are missing from the result.
 */
export default async function countByPost(postIds: string[]) {
  try {
    const counts: Record<string, number> = {};
    if (postIds.length === 0) return counts;

    const groups: { _id: string; count: number }[] = await comment.aggregate([
      { $match: { post: { $in: postIds }, removed: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    for (const group of groups) {
      counts[String(group._id)] = group.count;
    }

    return counts;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
  }
}
