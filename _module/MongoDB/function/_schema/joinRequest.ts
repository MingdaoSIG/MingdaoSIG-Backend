import mongoose from "mongoose";

const Schema = mongoose.Schema;

const joinRequestSchema = new Schema(
  {
    user: String,
    sig: String,
    // Answers to the SIG's questions (contract v4 §5.6), labelled with the
    // question as it was asked. q1..q3 keep the first three answers (extra
    // ones appended to q3) for the email template and older readers.
    answers: {
      type: [
        new Schema(
          { question: { type: String }, answer: { type: String } },
          { _id: false, id: false },
        ),
      ],
      default: undefined,
    },
    q1: String,
    q2: String,
    q3: String,
    removed: { type: Boolean, default: false },
    state: { type: String, default: "pending" }, // pending, accepted, rejected
    confirmId: String,
  },
  { timestamps: true },
);

// Lookup of a user's request to a SIG.
joinRequestSchema.index({ user: 1, sig: 1, removed: 1 });
// GET /admin/join-requests by state (oldest pending first, otherwise newest
// first), the pending counts in GET /admin/overview and GET /admin/sigs.
joinRequestSchema.index({ removed: 1, state: 1, createdAt: 1, _id: 1 });
// The same, for one SIG or the SIGs a manager manages.
joinRequestSchema.index({ sig: 1, removed: 1, state: 1, createdAt: 1, _id: 1 });

// ---- Unique indexes --------------------------------------------------------
// Check production data for duplicates before adding one here. A failed build
// is logged by @module/EnsureIndexes and does not stop the server.
// confirmId is a uuid v4 set on every new request (link in the leader email).
joinRequestSchema.index({ confirmId: 1 }, { unique: true });

export default mongoose.model(
  "join-request",
  joinRequestSchema,
  "join-request",
);
