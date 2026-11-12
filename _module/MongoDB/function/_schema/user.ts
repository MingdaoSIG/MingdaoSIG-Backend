import mongoose from "mongoose";

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    customId: String,
    // Earlier customIds, kept when an admin changes it: GET /user/@<old id>
    // answers with `redirectTo` (contract v4 §5.8).
    previousCustomIds: [String],
    email: String,
    name: String,
    code: String,
    class: String,
    identity: String,
    sig: [String],
    displayName: String,
    description: String,
    avatar: String,
    // Badge keys from the badge collection (@module/Badge); checked when an
    // admin sets them, not by the schema.
    badge: { type: [String], default: [] },
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
    // When the user finished or skipped the first-login onboarding (POST
    // /user `{ onboarded: true }`). GET /user/me also counts users who
    // already took part as onboarded (@module/Onboarding).
    onboardedAt: Date,
  },
  { timestamps: true },
);

// Lookups by email (login), customId (profile pages, custom id checks), code
// (adding a SIG leader) and sig (listing SIG members).
// email and customId are NOT unique on purpose: production still holds
// duplicates from a login race. Make them unique only after a dedupe migration.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ customId: 1 }, { unique: true });
// GET /user/@:id by an old customId, and the customId uniqueness check.
userSchema.index({ previousCustomIds: 1 });
userSchema.index({ code: 1 });
userSchema.index({ sig: 1 });
// GET /admin/users (newest first) and the GET /admin/overview counts
userSchema.index({ createdAt: -1, _id: -1 });
// The weekly digest run: users who opted in (sparse: very few do).
userSchema.index(
  { "notificationSettings.email.digest": 1, digestLastSentWeek: 1 },
  { partialFilterExpression: { "notificationSettings.email.digest": true } },
);

export default mongoose.model("user", userSchema, "user");
