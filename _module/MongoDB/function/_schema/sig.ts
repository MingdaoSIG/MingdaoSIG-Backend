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
  // ---- Admin-editable settings (API contract v4 §3.7) ----------------------
  // Image id: the cover of a post saved without one (@module/SigDefaults).
  defaultCover: String,
  // Accent colour, "#rrggbb".
  color: String,
  // Earlier customIds, kept when an admin changes it or merges this SIG's
  // source into it: GET /sig/@<old id> answers with `redirectTo`.
  previousCustomIds: [String],
});

// GET /sig/@:customId by an old customId.
sigSchema.index({ previousCustomIds: 1 });

export default mongoose.model("sig", sigSchema, "sig");
