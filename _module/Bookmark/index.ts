import mongoose from "mongoose";

/**
 * Bookmarks (收藏, contract v4 §4.3): `{ user, post, createdAt }`, one per
 * user and post. Adding and removing are idempotent.
 *
 * Collection: `bookmark`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    post: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
// GET /user/me/bookmarks and /user/me/bookmarks/ids (newest first)
bookmarkSchema.index({ user: 1, createdAt: -1, _id: -1 });

export const BookmarkModel =
  (mongoose.models.bookmark as mongoose.Model<any>) ??
  mongoose.model("bookmark", bookmarkSchema, "bookmark");

const DUPLICATE_KEY = 11000;

/** Bookmarks `post` for `user`; a second call changes nothing. */
export async function addBookmark(user: string, post: string) {
  try {
    await BookmarkModel.updateOne(
      { user, post },
      { $setOnInsert: { user, post } },
      { upsert: true },
    );
  } catch (error: any) {
    // Two concurrent first adds: the other one inserted it.
    if (error?.code !== DUPLICATE_KEY) throw error;
  }
}

/** Removes the bookmark if there is one. */
export async function removeBookmark(user: string, post: string) {
  await BookmarkModel.deleteOne({ user, post });
}

/** The post ids `user` bookmarked, newest bookmark first. */
export async function bookmarkedPostIds(user: string): Promise<string[]> {
  const rows = await BookmarkModel.find({ user }, { post: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  return rows.map((row: any) => String(row.post));
}
