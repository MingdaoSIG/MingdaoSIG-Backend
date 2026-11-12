import { Filter } from "@type/database";
import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const LIST_FIELDS = {
  content: 1,
  post: 1,
  user: 1,
  reply: 1,
  createdAt: 1,
  updatedAt: 1,
  removed: 1,
} as const;

const FLAG_FIELDS = { content: 1, post: 1, user: 1, removed: 1 } as const;

/** One page of comments (newest first) and the total for the same filter. */
export async function listComments(
  filter: Filter,
  option: { skip: number; limit: number },
) {
  try {
    const [data, total] = await Promise.all([
      comment
        .find(filter, LIST_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .skip(option.skip)
        .limit(option.limit)
        .lean(),
      comment.countDocuments(filter),
    ]);
    return { data: data as any[], total };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
  }
}

/**
 * Sets `removed` on a comment. `changed` is the updated comment when it was
 * different before, `current` is the comment as it is now (null when there
 * is none). Moderation is not an edit: `updatedAt` (and so the "edited"
 * marker) is left alone.
 */
export async function setCommentRemoved(id: string, removed: boolean) {
  try {
    const changed = await comment
      .findOneAndUpdate(
        { _id: id, removed: removed ? { $ne: true } : true },
        { $set: { removed } },
        { returnDocument: "after", projection: FLAG_FIELDS, timestamps: false },
      )
      .lean();
    if (changed) return { changed: changed as any, current: changed as any };

    const current = await comment.findById(id, FLAG_FIELDS).lean();
    return { changed: null, current: current as any };
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_COMMENT_TO_DB, error);
  }
}
