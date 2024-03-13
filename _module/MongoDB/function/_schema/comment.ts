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

export default mongoose.model("comment", commentSchema, "comment");
