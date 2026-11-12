import mongoose from "mongoose";

const Schema = mongoose.Schema;

const postSchema = new Schema(
  {
    sig: String,
    title: String,
    cover: String,
    content: String,
    user: String,
    hashtag: [String],
    like: [String],
    likes: { type: Number, default: 0 },
    priority: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One index per query shape. Built at startup by @module/EnsureIndexes.
// GET /post/list?sort=latest|oldest, GET /post/list/pinned
postSchema.index({ removed: 1, pinned: 1, createdAt: -1 });
// GET /post/list (default sort mostLikes)
postSchema.index({ removed: 1, pinned: 1, likes: -1 });
// GET /post/list/sig/:id
postSchema.index({ sig: 1, removed: 1, createdAt: -1 });
// GET /post/list/user/:id
postSchema.index({ user: 1, removed: 1, createdAt: -1 });
// GET /post/list/user/:id/like (multikey on the like array)
postSchema.index({ like: 1, removed: 1, createdAt: -1 });
// GET /post/list/range and the /information/* date filters
postSchema.index({ removed: 1, createdAt: 1 });

export default mongoose.model("post", postSchema, "post");
