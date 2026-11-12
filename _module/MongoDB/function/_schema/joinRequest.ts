import mongoose from "mongoose";


const Schema = mongoose.Schema;

const joinRequestSchema = new Schema(
  {
    user: String,
    sig: String,
    q1: String,
    q2: String,
    q3: String,
    removed: { type: Boolean, default: false },
    state: { type: String, default: "pending" }, // pending, accepted, rejected
    confirmId: String
  },
  { timestamps: true }
);

// Lookup of a user's request to a SIG.
joinRequestSchema.index({ user: 1, sig: 1, removed: 1 });

// ---- Unique indexes --------------------------------------------------------
// Check production data for duplicates before adding one here. A failed build
// is logged by @module/EnsureIndexes and does not stop the server.
// confirmId is a uuid v4 set on every new request (link in the leader email).
joinRequestSchema.index({ confirmId: 1 }, { unique: true });

export default mongoose.model(
  "join-request",
  joinRequestSchema,
  "join-request"
);
