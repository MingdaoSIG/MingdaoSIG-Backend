import mongoose, { isValidObjectId } from "mongoose";
import webpush from "web-push";

import MongoDB from "@module/MongoDB";
import { onNotification } from "@module/Notify";
import { allowsPush } from "@module/NotificationSettings";

/**
 * Web push (VAPID) for stored notifications (contract v4 §2.3).
 *
 * - Enabled only when WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and
 *   WEB_PUSH_SUBJECT are all set and valid; otherwise the /push routes answer
 *   503/5000 and nothing is sent. ValidateEnv warns about missing values,
 *   this module about invalid ones.
 * - Subscriptions (collection `push-subscription`) are upserted by endpoint.
 *   A user keeps at most MAX_SUBSCRIPTIONS_PER_USER (the oldest go first).
 * - Every stored notification is pushed to all of the recipient's
 *   subscriptions unless `notificationSettings.push[type]` is false.
 *   Subscriptions the push service answers 404/410 for are deleted.
 * - Endpoints and keys are never logged.
 */

const UserDB = new MongoDB.User();

const MAX_SUBSCRIPTIONS_PER_USER = 20;
const SEND_TIMEOUT_MS = 10_000;
// A push the device cannot take within a day is dropped by the push service.
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const BODY_LENGTH = 100;

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true },
);

subscriptionSchema.index({ endpoint: 1 }, { unique: true });
subscriptionSchema.index({ user: 1, updatedAt: -1 });

export const PushSubscriptionModel =
  (mongoose.models["push-subscription"] as mongoose.Model<any>) ??
  mongoose.model("push-subscription", subscriptionSchema, "push-subscription");

export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type PushConfig = { enabled: true; publicKey: string } | { enabled: false };
let config: PushConfig | undefined;

/**
 * The VAPID configuration, read once on first use (the routers load before
 * index.ts reads .env, so not at import time).
 */
export function pushConfig(): PushConfig {
  if (config) return config;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    config = { enabled: false };
    return config;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    config = { enabled: true, publicKey };
  } catch (error) {
    // The messages name the problem, never the private key.
    console.warn(
      `Push : WEB_PUSH_* is invalid, web push is disabled: ${
        error instanceof Error ? error.message : error
      }`,
    );
    config = { enabled: false };
  }
  return config;
}

/** Upserts the subscription by endpoint for `userId`. */
export async function saveSubscription(
  userId: string,
  subscription: BrowserSubscription,
) {
  const update = {
    $set: { user: userId, keys: subscription.keys },
  };
  try {
    await PushSubscriptionModel.updateOne(
      { endpoint: subscription.endpoint },
      update,
      { upsert: true },
    );
  } catch (error: any) {
    // Two upserts of a new endpoint at once: the second one updates.
    if (error?.code !== 11000) throw error;
    await PushSubscriptionModel.updateOne(
      { endpoint: subscription.endpoint },
      update,
    );
  }

  const extra = await PushSubscriptionModel.find({ user: userId }, { _id: 1 })
    .sort({ updatedAt: -1, _id: -1 })
    .skip(MAX_SUBSCRIPTIONS_PER_USER)
    .lean();
  if (extra.length > 0) {
    await PushSubscriptionModel.deleteMany({
      _id: { $in: extra.map((item) => item._id) },
    });
  }
}

/** Deletes the caller's subscription with this endpoint; returns the count. */
export async function removeSubscription(userId: string, endpoint: string) {
  const result = await PushSubscriptionModel.deleteOne({
    user: userId,
    endpoint,
  });
  return result.deletedCount ?? 0;
}

/** Sends one stored notification to the recipient's devices. */
export async function dispatchPush(notification: Record<string, any>) {
  if (!pushConfig().enabled) return;

  const recipient = String(notification.recipient ?? "");
  if (!isValidObjectId(recipient)) return;

  const [user] = await UserDB.list(
    { _id: recipient },
    { lean: true, projection: { notificationSettings: 1 } },
  );
  if (!user || !allowsPush(user, notification.type)) return;

  const subscriptions = await PushSubscriptionModel.find({
    user: recipient,
  }).lean();
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify(await pushPayload(notification));
  await Promise.all(
    subscriptions.map((subscription) => send(subscription, payload)),
  );
}

async function send(subscription: Record<string, any>, payload: string) {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      payload,
      { TTL: PUSH_TTL_SECONDS, timeout: SEND_TIMEOUT_MS },
    );
  } catch (error: any) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      // The browser dropped the subscription.
      await PushSubscriptionModel.deleteOne({ _id: subscription._id });
      return;
    }
    // Not the message: a request error can carry the endpoint URL.
    console.warn(
      `Push : delivery failed (${
        status ? `HTTP ${status}` : error?.code || "request error"
      })`,
    );
  }
}

/** `{ title, body, url, tag }` for the service worker. */
export async function pushPayload(notification: Record<string, any>) {
  const actorName = await nameOf(notification.actor);
  const label = String(notification.target?.label ?? "");
  const excerpt =
    typeof notification.meta?.excerpt === "string"
      ? notification.meta.excerpt
      : "";
  // `system` notifications carry their own text (contract v4 §5.5).
  const message =
    typeof notification.meta?.message === "string"
      ? notification.meta.message
      : "";
  return {
    title: pushTitle(notification, actorName),
    body: cut(excerpt || message || label, BODY_LENGTH),
    url: String(notification.link ?? "/"),
    tag: String(notification.collapseKey || notification._id),
  };
}

/** The notification's title in Traditional Chinese. */
export function pushTitle(
  notification: Record<string, any>,
  actorName: string,
) {
  const who = actorName || "有人";
  const count = Number(notification.meta?.count) || 1;
  const label = String(notification.target?.label ?? "");
  const sigName = label || "SIG";

  switch (notification.type) {
    case "comment":
      return `${who} 留言了你的貼文`;
    case "reply":
      return `${who} 回覆了你的留言`;
    case "like":
      return count > 1 ? `${count} 人按讚了你的貼文` : `${who} 按讚了你的貼文`;
    case "join_request":
      return count > 1
        ? `${count} 人申請加入 ${sigName}`
        : `${who} 申請加入 ${sigName}`;
    case "join_result":
      return `你加入 ${sigName} 的申請${
        notification.meta?.accepted ? "已通過" : "未通過"
      }`;
    case "feedback":
      return `${who} 回饋了你的貼文`;
    case "event": {
      const sig = notification.meta?.sigName;
      return typeof sig === "string" && sig
        ? `${sig} 有新活動`
        : "你的 SIG 有新活動";
    }
    case "report_result":
      return "你的檢舉已處理";
    case "system": {
      const title = notification.meta?.title;
      return typeof title === "string" && title ? title : "MDSIG 通知";
    }
    default:
      return "MDSIG 通知";
  }
}

async function nameOf(userId: unknown) {
  if (typeof userId !== "string" || !isValidObjectId(userId)) return "";
  const [user] = await UserDB.list(
    { _id: userId },
    { lean: true, projection: { name: 1 } },
  );
  return user?.name?.trim() ?? "";
}

// At most `length` characters (code points), "…" included.
function cut(text: string, length: number) {
  const characters = Array.from(text.replace(/\s+/g, " ").trim());
  if (characters.length <= length) return characters.join("");
  return `${characters.slice(0, length - 1).join("")}…`;
}

onNotification(dispatchPush);
