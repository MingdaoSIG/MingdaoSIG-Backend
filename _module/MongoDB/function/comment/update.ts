import { Comment } from "@type/comment";
import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

/**
 * Replaces the content of a comment that is not removed. `updatedAt` moves,
 * which is what marks the comment as edited. Returns null when there is no
 * such comment.
 */
export async function editContent(id: string, content: string) {
  try {
    const data = await comment
      .findOneAndUpdate(
        { _id: id, removed: false },
        { $set: { content } },
        { returnDocument: "after" },
      )
      .lean();

    return data ? (leanDefaults(comment, data) as unknown as Comment) : null;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_COMMENT_TO_DB, error);
  }
}

/**
 * Soft deletes a comment that is not removed yet. A deletion is not an edit,
 * so `updatedAt` (and the "edited" marker) is left alone. Returns the removed
 * comment, or null when it was already removed or does not exist.
 */
export async function markRemoved(id: string) {
  try {
    const data = await comment
      .findOneAndUpdate(
        { _id: id, removed: false },
        { $set: { removed: true } },
        { returnDocument: "after", timestamps: false },
      )
      .lean();

    return data as unknown as Comment | null;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_COMMENT_TO_DB, error);
  }
}
