import mongoose from "mongoose";


const Schema = mongoose.Schema;

const commentSchema = new Schema(
  {
    user: String,
    post: String,
    content: String,
    like: [String],
    reply: String,
    removed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// GET /comment/list/post/:postId, and the comment counts in GET /post/list
// (which use the { post, removed } prefix).
commentSchema.index({ post: 1, removed: 1, reply: 1, createdAt: -1 });

export default mongoose.model("comment", commentSchema, "comment");
