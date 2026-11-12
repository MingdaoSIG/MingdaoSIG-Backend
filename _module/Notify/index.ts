import mongoose from "mongoose";

/**
 * In-app notifications (the bell). Creating one never fails the action that
 * caused it: errors are logged and swallowed.
 *
 * - Notifying yourself (recipient === actor) is skipped.
 * - `collapseKey`: when the recipient still has an UNREAD notification with
 *   the same key, that one is updated (latest actor, meta.count + 1, moved to
 *   the top) instead of adding another, e.g. "3 people liked your post".
 * - Other delivery channels (web push, …) register with `onNotification`;
 *   they run after the notification is stored and their errors are logged.
 * - Notifications expire after 180 days (TTL index).
 *
 * Collection: `notification`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const NOTIFICATION_TYPES = [
  "comment", // someone commented on your post
  "reply", // someone replied to your comment
  "like", // someone liked your post (collapsed per post)
  "join_request", // (managers) someone applied to your SIG
  "join_result", // your application was accepted / rejected
  "feedback", // a teacher left feedback on your post
  "event", // a new event in one of your SIGs
  "report_result", // a report you filed was handled
  "system", // anything else from admins
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationTargetKind =
  | "post"
  | "comment"
  | "sig"
  | "event"
  | "join"
  | "report";

export interface NotifyInput {
  recipient: string;
  type: NotificationType;
  /** user id of whoever caused it; null for system notifications */
  actor: string | null;
  target: { kind: NotificationTargetKind; id: string; label?: string };
  /** frontend path to open, e.g. "/post/<id>" or "/admin/join-requests" */
  link: string;
  /** small extra facts for rendering (e.g. { accepted: true }, { excerpt }) */
  meta?: Record<string, unknown>;
  collapseKey?: string;
}

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    actor: { type: String, default: null },
    target: {
      kind: { type: String, required: true },
      id: { type: String, required: true },
      label: { type: String, default: "" },
    },
    link: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    collapseKey: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, collapseKey: 1, read: 1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);

export const NotificationModel =
  (mongoose.models.notification as mongoose.Model<any>) ??
  mongoose.model("notification", notificationSchema, "notification");

type Dispatcher = (notification: Record<string, any>) => Promise<void> | void;
const dispatchers: Dispatcher[] = [];

/** Register an extra delivery channel (e.g. web push). */
export function onNotification(dispatcher: Dispatcher) {
  dispatchers.push(dispatcher);
}

async function store(input: NotifyInput) {
  const label = (input.target.label ?? "").slice(0, 200);
  if (input.collapseKey) {
    const updated = await NotificationModel.findOneAndUpdate(
      {
        recipient: input.recipient,
        collapseKey: input.collapseKey,
        read: false,
      },
      {
        $set: {
          actor: input.actor,
          "target.label": label,
          link: input.link,
          createdAt: new Date(),
        },
        $inc: { "meta.count": 1 },
      },
      { returnDocument: "after", lean: true, timestamps: false },
    );
    if (updated) return updated;
  }
  const created = await NotificationModel.create({
    recipient: input.recipient,
    type: input.type,
    actor: input.actor,
    target: { kind: input.target.kind, id: input.target.id, label },
    link: input.link,
    meta: { ...(input.meta ?? {}), count: 1 },
    collapseKey: input.collapseKey ?? null,
  });
  return created.toObject();
}

/** Create one or more notifications. Never throws. */
export async function notify(input: NotifyInput | NotifyInput[]) {
  const inputs = (Array.isArray(input) ? input : [input]).filter(
    (n) => n.recipient && n.recipient !== n.actor,
  );
  for (const n of inputs) {
    try {
      const saved = await store(n);
      for (const dispatch of dispatchers) {
        Promise.resolve()
          .then(() => dispatch(saved))
          .catch((error) =>
            console.error(
              `Notify : dispatcher failed for ${n.type}:`,
              error instanceof Error ? error.message : error,
            ),
          );
      }
    } catch (error) {
      console.error(
        `Notify : failed to store ${n.type} for ${n.target.kind}:${n.target.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/** Newest first, with the recipient's unread count. */
export async function listNotifications(
  recipient: string,
  option: { skip?: number; limit?: number; unreadOnly?: boolean } = {},
) {
  const query: Record<string, unknown> = { recipient };
  if (option.unreadOnly) query.read = false;
  const skip = Math.max(0, option.skip ?? 0);
  const limit = Math.min(100, Math.max(1, option.limit ?? 30));
  const [data, total, unread] = await Promise.all([
    NotificationModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    NotificationModel.countDocuments(query),
    NotificationModel.countDocuments({ recipient, read: false }),
  ]);
  return { data, total, unread };
}

export async function countUnread(recipient: string) {
  return NotificationModel.countDocuments({ recipient, read: false });
}

/** Mark the given ids (or every notification) of the recipient as read. */
export async function markRead(recipient: string, ids: string[] | "all") {
  const query: Record<string, unknown> = { recipient, read: false };
  if (ids !== "all") {
    query._id = {
      $in: ids.filter((id) => mongoose.isValidObjectId(id)),
    };
  }
  const result = await NotificationModel.updateMany(query, {
    $set: { read: true },
  });
  return result.modifiedCount;
}
