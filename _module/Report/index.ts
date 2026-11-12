import mongoose from "mongoose";

/**
 * Reports (檢舉, contract v4 §4.6) on a post or a comment.
 *
 * - A reporter has at most one open report per target (a partial unique
 *   index on the open ones).
 * - Handling a report closes every open report on the same target.
 *
 * Collection: `report`. Indexes are built at startup by @module/EnsureIndexes
 * once a router imports this module.
 */

export const REPORT_TARGET_KINDS = ["post", "comment"] as const;
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "privacy",
  "other",
] as const;
export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;

export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTE_MAX = 300;
export const RESOLUTION_MAX = 300;

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: String, required: true },
    target: {
      kind: { type: String, required: true, enum: REPORT_TARGET_KINDS },
      id: { type: String, required: true },
    },
    reason: { type: String, required: true, enum: REPORT_REASONS },
    note: { type: String, default: "" },
    status: {
      type: String,
      required: true,
      enum: REPORT_STATUSES,
      default: "open",
    },
    handledBy: { type: String, default: null },
    resolution: { type: String, default: "" },
  },
  { timestamps: true },
);

// One open report per reporter and target.
reportSchema.index(
  { reporter: 1, "target.kind": 1, "target.id": 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
// GET /admin/reports (by status, oldest or newest first) and the open count
reportSchema.index({ status: 1, createdAt: 1, _id: 1 });
// Closing every open report on a target
reportSchema.index({ "target.kind": 1, "target.id": 1, status: 1 });

export const ReportModel =
  (mongoose.models.report as mongoose.Model<any>) ??
  mongoose.model("report", reportSchema, "report");

export async function countOpenReports() {
  return ReportModel.countDocuments({ status: "open" });
}
