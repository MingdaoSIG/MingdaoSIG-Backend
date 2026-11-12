import mongoose from "mongoose";

const Schema = mongoose.Schema;

const sigSchema = new Schema({
  name: String,
  description: String,
  avatar: String,
  // Ids of the users following the SIG (contract v4 §6.1, @module/SigFollow).
  // Private: public reads return `followerCount` instead.
  follower: [String],
  customId: String,
  moderator: [String],
  leader: [String],
  removed: { type: Boolean, default: false },
  // Showcase (精選成果): up to 6 post ids of this SIG, in order. Public; the
  // SIG reads resolve them to post list items.
  featuredPosts: { type: [String], default: undefined },
  // Discord announcement webhook URL. Private: never selected unless a query
  // asks for "+discordWebhook", so no read returns or logs it.
  discordWebhook: { type: String, select: false },
});

// GET /user/me `followedSigs` and the followed SIGs of the my-SIG feed
// (multikey on the follower ids).
sigSchema.index({ follower: 1 });

export default mongoose.model("sig", sigSchema, "sig");
