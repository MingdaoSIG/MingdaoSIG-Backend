import mongoose from "mongoose";

/**
 * Audit log for moderation and administration actions (who did what, when,
 * to which object). Writing an entry never fails the action that caused it:
 * errors are logged and swallowed.
 *
 * Collection: `audit-log`. Indexes are declared on the schema and built at
 * startup by @module/EnsureIndexes (this module must be imported somewhere on
 * the startup path, which every router that records an action does).
 */

export const AUDIT_ACTIONS = [
  "post.pin",
  "post.unpin",
  "post.remove",
  "post.restore",
  "comment.remove",
  "comment.restore",
  "user.permission",
  "user.badges",
  "sig.update",
  "sig.leader.add",
  "sig.leader.remove",
  "sig.moderator.add",
  "sig.moderator.remove",
  "sig.member.remove",
  "join.accept",
  "join.reject",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditTargetKind = "post" | "comment" | "user" | "sig" | "join";

export interface AuditEntryInput {
  /** user id of whoever performed the action */
  actor: string;
  action: AuditAction;
  target: {
    kind: AuditTargetKind;
    id: string;
    /** human-readable label at the time of the action (title, name…) */
    label?: string;
  };
  /** small, non-sensitive details (e.g. { admin: true }, { sig: "<id>" }) */
  meta?: Record<string, unknown>;
}

const auditSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    target: {
      kind: { type: String, required: true },
      id: { type: String, required: true },
      label: { type: String, default: "" },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
auditSchema.index({ "target.kind": 1, "target.id": 1, createdAt: -1 });

export const AuditModel =
  (mongoose.models["audit-log"] as mongoose.Model<any>) ??
  mongoose.model("audit-log", auditSchema, "audit-log");

/** Record an action. Never throws. */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  try {
    await AuditModel.create({
      actor: entry.actor,
      action: entry.action,
      target: {
        kind: entry.target.kind,
        id: entry.target.id,
        label: (entry.target.label ?? "").slice(0, 200),
      },
      meta: entry.meta ?? {},
    });
  } catch (error) {
    console.error(
      `Audit : failed to record ${entry.action} on ${entry.target.kind}:${entry.target.id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

export interface AuditListFilter {
  action?: AuditAction;
  actor?: string;
  targetKind?: AuditTargetKind;
  targetId?: string;
}

/** Newest first. Returns plain objects and the total for the same filter. */
export async function listAudit(
  filter: AuditListFilter,
  option: { skip?: number; limit?: number } = {},
) {
  const query: Record<string, unknown> = {};
  if (filter.action) query.action = filter.action;
  if (filter.actor) query.actor = filter.actor;
  if (filter.targetKind) query["target.kind"] = filter.targetKind;
  if (filter.targetId) query["target.id"] = filter.targetId;

  const skip = Math.max(0, option.skip ?? 0);
  const limit = Math.min(100, Math.max(1, option.limit ?? 50));

  const [data, total] = await Promise.all([
    AuditModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditModel.countDocuments(query),
  ]);
  return { data, total };
}
