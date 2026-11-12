import mongoose from "mongoose";

const Schema = mongoose.Schema;

// 停權 / 禁言 (@module/Suspension). `until` null means indefinite.
const suspensionSchema = new Schema(
  {
    type: { type: String, enum: ["mute", "ban"], required: true },
    until: { type: Date, default: null },
    reason: String,
    // user id of the admin or content moderator who set it
    by: String,
    createdAt: Date,
  },
  { _id: false },
);

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
    // Email me when someone comments on my post or replies to my comment.
    // Private: returned by /login and /user/me, set through POST /user.
    notifyComments: { type: Boolean, default: true },
    // Push and email notification settings (@module/NotificationSettings).
    // Only the keys a user changed are stored; missing keys mean the
    // defaults. Private, like notifyComments.
    notificationSettings: {
      push: {
        comment: Boolean,
        reply: Boolean,
        like: Boolean,
        join_request: Boolean,
        join_result: Boolean,
        feedback: Boolean,
        event: Boolean,
      },
      email: {
        comment: Boolean,
        digest: Boolean,
      },
    },
    // ISO week ("2026-W46", Asia/Taipei) of the last weekly digest email.
    digestLastSentWeek: String,
    // Absent unless suspended. Private: the user sees it (while it is in
    // force) on /login and /user/me; admins and content moderators in
    // /admin/users.
    suspension: { type: suspensionSchema, default: undefined },
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
// GET /admin/users (newest first) and the GET /admin/overview counts
userSchema.index({ createdAt: -1, _id: -1 });
// The weekly digest run: users who opted in (sparse: very few do).
userSchema.index(
  { "notificationSettings.email.digest": 1, digestLastSentWeek: 1 },
  { partialFilterExpression: { "notificationSettings.email.digest": true } },
);

// GET /admin/users?suspended=1 (sparse: very few users are suspended).
userSchema.index(
  { "suspension.until": 1 },
  { partialFilterExpression: { "suspension.type": { $exists: true } } },
);

export default mongoose.model("user", userSchema, "user");
