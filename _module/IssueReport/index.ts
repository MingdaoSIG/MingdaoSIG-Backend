import mongoose from "mongoose";

/**
 * Issue reports (問題回報): bugs, suggestions and account problems that
 * signed-in users send from the site, replacing the old Google Form.
 *
 * - The reporter sees their own reports and the admins' reply under
 *   個人專區 → 我的回報 (GET /issue-report/mine).
 * - Admins handle them under /admin/issue-reports. A reply or closing a
 *   report notifies the reporter; a new report notifies every admin.
 *
 * Collection: `issue-report`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const ISSUE_CATEGORIES = [
  "bug", // 錯誤
  "suggestion", // 建議
  "account", // 帳號問題
  "other", // 其他
] as const;
export const ISSUE_STATUSES = [
  "open", // 待處理
  "in_progress", // 處理中
  "resolved", // 已解決
  "closed", // 不處理
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "待處理",
  in_progress: "處理中",
  resolved: "已解決",
  closed: "不處理",
};

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const REPLY_MAX = 1000;
export const IMAGES_MAX = 3;
/** Reports one user may send per rolling hour (4290 above it). */
export const REPORTS_PER_HOUR = 5;

/** What the browser attaches automatically, each a short string. */
export const CONTEXT_LIMITS = {
  pageUrl: 500, // the page the user was on
  appVersion: 40, // frontend version
  userAgent: 400,
  viewport: 20, // "1440x900"
  errorDigest: 200, // Next.js error digest from an error page
} as const;
export type IssueContextKey = keyof typeof CONTEXT_LIMITS;

const issueReportSchema = new mongoose.Schema(
  {
    reporter: { type: String, required: true },
    category: { type: String, required: true, enum: ISSUE_CATEGORIES },
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: { type: [String], default: [] }, // image ids (GET /image/:id)
    context: {
      pageUrl: { type: String, default: "" },
      appVersion: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      viewport: { type: String, default: "" },
      errorDigest: { type: String, default: "" },
    },
    status: {
      type: String,
      required: true,
      enum: ISSUE_STATUSES,
      default: "open",
    },
    reply: { type: String, default: "" },
    repliedAt: { type: Date, default: null },
    handledBy: { type: String, default: null },
  },
  { timestamps: true },
);

// The reporter's own list (newest first) and the hourly limit
issueReportSchema.index({ reporter: 1, createdAt: -1 });
// GET /admin/issue-reports by status, and the open count
issueReportSchema.index({ status: 1, createdAt: -1, _id: -1 });

export const IssueReportModel =
  (mongoose.models["issue-report"] as mongoose.Model<any>) ??
  mongoose.model("issue-report", issueReportSchema, "issue-report");

export async function countOpenIssueReports() {
  return IssueReportModel.countDocuments({ status: "open" });
}

/** The reporter-facing shape (no internal ids of admins). */
export function issueReportView(doc: any) {
  return {
    _id: String(doc._id),
    category: doc.category,
    title: doc.title ?? "",
    description: doc.description ?? "",
    images: Array.isArray(doc.images) ? doc.images.map(String) : [],
    context: {
      pageUrl: doc.context?.pageUrl ?? "",
      appVersion: doc.context?.appVersion ?? "",
      userAgent: doc.context?.userAgent ?? "",
      viewport: doc.context?.viewport ?? "",
      errorDigest: doc.context?.errorDigest ?? "",
    },
    status: doc.status,
    reply: doc.reply ?? "",
    repliedAt: doc.repliedAt ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}
