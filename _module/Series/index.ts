import mongoose, { isValidObjectId } from "mongoose";

import post from "@schema/post";

/**
 * Series (系列, contract v4 §4.4): an ordered list of the owner's own posts.
 * Removed posts stay in `posts` but drop out of every read, so they come back
 * if the post is restored. A removed series is never returned.
 *
 * Collection: `series`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 300;

const seriesSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    posts: { type: [String], default: [] },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// GET /user/:id/series
seriesSchema.index({ user: 1, removed: 1, createdAt: -1 });
// The series of a post on GET /post/:id (multikey)
seriesSchema.index({ posts: 1, removed: 1 });

export const SeriesModel =
  (mongoose.models.series as mongoose.Model<any>) ??
  mongoose.model("series", seriesSchema, "series");

/** Non-removed posts among `ids` (only the projected fields), by id. */
export async function visiblePosts(
  ids: Iterable<string>,
  projection: Record<string, 0 | 1> = { _id: 1 },
) {
  const list = Array.from(new Set(ids)).filter((id) => isValidObjectId(id));
  const map = new Map<string, any>();
  if (list.length === 0) return map;

  const docs = await post
    .find({ _id: { $in: list }, removed: false }, projection)
    .lean();
  for (const doc of docs) map.set(String(doc._id), doc);
  return map;
}

/** Whether every id is a non-removed post written by `owner`. */
export async function areOwnVisiblePosts(owner: string, ids: string[]) {
  if (ids.length === 0) return true;
  if (!ids.every((id) => isValidObjectId(id))) return false;

  const count = await post.countDocuments({
    _id: { $in: ids },
    user: owner,
    removed: false,
  });
  return count === ids.length;
}

/**
 * Every non-removed series containing `postId` (oldest series first), with
 * the post's place among the series' visible posts. `index` is 0-based.
 */
export async function seriesNavigation(postId: string) {
  const seriesList = await SeriesModel.find(
    { posts: postId, removed: false },
    { title: 1, posts: 1 },
  )
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (seriesList.length === 0) return [];

  const posts = await visiblePosts(
    seriesList.flatMap((series: any) => series.posts as string[]),
    { title: 1 },
  );
  const brief = (id: string) => ({
    _id: id,
    title: posts.get(id)?.title ?? "",
  });

  return seriesList.flatMap((series: any) => {
    const visible = (series.posts as string[]).filter((id) => posts.has(id));
    const index = visible.indexOf(postId);
    if (index === -1) return [];
    return [
      {
        _id: String(series._id),
        title: series.title ?? "",
        index,
        total: visible.length,
        prev: index > 0 ? brief(visible[index - 1]) : null,
        next: index < visible.length - 1 ? brief(visible[index + 1]) : null,
      },
    ];
  });
}
