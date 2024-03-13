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

export default mongoose.model(
  "join-request",
  joinRequestSchema,
  "join-request"
);
