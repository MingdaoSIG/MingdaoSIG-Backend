import mongoose from "mongoose";

const Schema = mongoose.Schema;

const sigSchema = new Schema({
  name: String,
  description: String,
  avatar: String,
  follower: [String],
  customId: String,
  moderator: [String],
  leader: [String],
  removed: { type: Boolean, default: false },
  // Showcase (精選成果): up to 6 post ids of this SIG, in order. Public; the
  // SIG reads resolve them to post list items.
  featuredPosts: { type: [String], default: undefined },
});

export default mongoose.model("sig", sigSchema, "sig");
