import mongoose from "mongoose";

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    customId: String,
    email: String,
    name: String,
    code: String,
    class: String,
    identity: String,
    sig: [String],
    displayName: String,
    description: String,
    avatar: String,
    badge: {
      type: [
        {
          type: String,
          // Same list as the frontend (app/[userID]/(User)/config/badge.ts).
          enum: ["developer", "10.21_user", "bug_hunter"],
        },
      ],
      default: [],
    },
    follower: [String],
    permission: Number,
  },
  { timestamps: true },
);

// Lookups by email (login), customId (profile pages, custom id checks), code
// (adding a SIG leader) and sig (listing SIG members).
// email and customId are NOT unique on purpose: production still holds
// duplicates from a login race. Make them unique only after a dedupe migration.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ customId: 1 }, { unique: true });
userSchema.index({ code: 1 });
userSchema.index({ sig: 1 });

export default mongoose.model("user", userSchema, "user");
