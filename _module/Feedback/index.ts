import mongoose, { isValidObjectId } from "mongoose";

/**
 * Teacher feedback on posts (老師回饋, API contract v4 §3.2). Private: only the
 * post's author, the moderators (指導老師) of the post's SIG and admins may
 * read it. Removing feedback is a soft delete.
 *
 * Collection: `feedback`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const FEEDBACK_MAX_LENGTH = 1000;

const feedbackSchema = new mongoose.Schema(
  {
    post: { type: String, required: true },
    author: { type: String, required: true },
    content: { type: String, required: true },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// GET /post/:id/feedback and the portfolio: a post's feedback, oldest first.
feedbackSchema.index({ post: 1, removed: 1, createdAt: 1 });

export const FeedbackModel =
  (mongoose.models.feedback as mongoose.Model<any>) ??
  mongoose.model("feedback", feedbackSchema, "feedback");

export type FeedbackDoc = {
  _id: unknown;
  post: string;
  author: string;
  content: string;
  removed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function createFeedback(
  post: string,
  author: string,
  content: string,
) {
  const created = await FeedbackModel.create({ post, author, content });
  return created.toObject() as FeedbackDoc;
}

/** A non-removed feedback entry, or null. */
export async function readFeedback(id: string) {
  if (!isValidObjectId(id)) return null;
  return (await FeedbackModel.findOne({
    _id: id,
    removed: false,
  }).lean()) as FeedbackDoc | null;
}

/** Sets the content of a non-removed entry; null when there is none. */
export async function editFeedback(id: string, content: string) {
  return (await FeedbackModel.findOneAndUpdate(
    { _id: id, removed: false },
    { $set: { content } },
    { returnDocument: "after", lean: true },
  )) as FeedbackDoc | null;
}

/** Soft-removes a non-removed entry; null when there is none. */
export async function removeFeedback(id: string) {
  return (await FeedbackModel.findOneAndUpdate(
    { _id: id, removed: false },
    { $set: { removed: true } },
    { returnDocument: "after", lean: true },
  )) as FeedbackDoc | null;
}

/** The non-removed feedback of each post, oldest first, keyed by post id. */
export async function feedbackByPost(postIds: string[]) {
  const byPost = new Map<string, FeedbackDoc[]>();
  if (postIds.length === 0) return byPost;

  const docs = (await FeedbackModel.find({
    post: { $in: postIds },
    removed: false,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()) as FeedbackDoc[];
  for (const doc of docs) {
    const list = byPost.get(doc.post) ?? [];
    list.push(doc);
    byPost.set(doc.post, list);
  }
  return byPost;
}
