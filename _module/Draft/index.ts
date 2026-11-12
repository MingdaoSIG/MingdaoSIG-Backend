import mongoose from "mongoose";

/**
 * Cloud drafts (contract v4 §4.5): the editor's autosave for a signed-in
 * user. Private to the owner, at most 20 per user, deleted for good.
 *
 * Collection: `draft`. Indexes are built at startup by @module/EnsureIndexes
 * once a router imports this module.
 */

export const MAX_DRAFTS_PER_USER = 20;
// Same limit as a post (POST /post).
export const CONTENT_MAX = 100000;

const draftSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    title: { type: String, default: "" },
    sig: { type: String, default: "" },
    content: { type: String, default: "" },
    cover: { type: String, default: "" },
    hashtag: { type: [String], default: [] },
    // The post being edited, or null for a new post.
    post: { type: String, default: null },
  },
  { timestamps: true },
);

// GET /draft (newest first) and the per-user limit
draftSchema.index({ user: 1, updatedAt: -1, _id: -1 });

export const DraftModel =
  (mongoose.models.draft as mongoose.Model<any>) ??
  mongoose.model("draft", draftSchema, "draft");

/** The stored fields a draft read returns. */
export function toDraft(draft: any) {
  return {
    _id: String(draft._id),
    user: draft.user,
    title: draft.title ?? "",
    sig: draft.sig ?? "",
    content: draft.content ?? "",
    cover: draft.cover ?? "",
    hashtag: draft.hashtag ?? [],
    post: draft.post ?? null,
    createdAt: draft.createdAt ?? null,
    updatedAt: draft.updatedAt ?? null,
  };
}
