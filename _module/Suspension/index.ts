import { Response } from "express";

import user from "@schema/user";
import { CustomCode, CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";

/**
 * Suspensions (停權 / 禁言, contract v4 §5.1), stored on the user as
 * `user.suspension = { type, until, reason, by, createdAt }`.
 *
 * - `ban`: every JWT route and /login answer 403/4041.
 * - `mute`: the write routes in MUTE_RESTRICTED answer 403/4041; reading,
 *   reporting, bookmarks and drafts still work.
 * - `until` null means indefinite. An expired suspension counts as none and
 *   is cleared the next time the user is seen (JWTverifier, /login).
 */

export const SUSPENSION_TYPES = ["mute", "ban"] as const;
export type SuspensionType = (typeof SUSPENSION_TYPES)[number];

export const SUSPENSION_REASON_MAX = 200;

export type Suspension = {
  type: SuspensionType;
  until: Date | null;
  reason: string;
  by: string;
  createdAt: Date;
};

/** The suspension in API responses (dates as ISO strings). */
export type SuspensionView = {
  type: SuspensionType;
  until: string | null;
  reason: string;
};

/**
 * The suspension if it is in force at `now`, otherwise null. A `until` that
 * is not a valid date counts as indefinite (fail closed).
 */
export function activeSuspension(
  value: unknown,
  now = Date.now(),
): Suspension | null {
  if (!value || typeof value !== "object") return null;
  const suspension = value as Partial<Suspension>;
  if (!SUSPENSION_TYPES.includes(suspension.type as SuspensionType))
    return null;

  if (suspension.until !== null && suspension.until !== undefined) {
    const until = new Date(suspension.until).getTime();
    if (!Number.isNaN(until) && until <= now) return null;
  }
  return suspension as Suspension;
}

/** A stored suspension that is no longer in force. */
export function isExpiredSuspension(value: unknown, now = Date.now()) {
  return Boolean(value) && !activeSuspension(value, now);
}

export function suspensionView(suspension: Suspension): SuspensionView {
  const until =
    suspension.until === null || suspension.until === undefined
      ? null
      : new Date(suspension.until);
  return {
    type: suspension.type,
    until: until && !Number.isNaN(until.getTime()) ? until.toISOString() : null,
    reason: suspension.reason ?? "",
  };
}

/**
 * Removes the user's suspension if it has expired by `now`. Never throws; a
 * failure only means it is cleared on a later request.
 */
export async function clearExpiredSuspension(userId: string, now = new Date()) {
  try {
    await user.updateOne(
      { _id: userId, "suspension.until": { $lte: now } },
      { $unset: { suspension: 1 } },
    );
  } catch (error) {
    console.error(
      "Suspension : failed to clear an expired suspension:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** 403 `{ status: 4041, message, data: { type, until, reason } }`. */
export function sendSuspended(res: Response, suspension: Suspension) {
  return res.status(HttpStatus.FORBIDDEN).json({
    status: CustomStatus.ACCOUNT_SUSPENDED,
    message: CustomCode[CustomStatus.ACCOUNT_SUSPENDED],
    data: suspensionView(suspension),
  });
}

/**
 * The write routes a muted user may not use (method and full path, matched
 * case-insensitively with an optional trailing slash, like Express routes):
 * post create/edit, comment create/edit, like, join request, event RSVP and
 * teacher feedback.
 */
const ID = "[^/]+";
const MUTE_RESTRICTED: [string, RegExp][] = [
  ["POST", /^\/post$/i], // create a post
  ["POST", new RegExp(`^/post/${ID}$`, "i")], // edit a post
  ["POST", new RegExp(`^/post/${ID}/like$`, "i")],
  ["POST", new RegExp(`^/post/${ID}/feedback$`, "i")],
  ["POST", /^\/comment$/i], // create a comment or reply
  ["POST", new RegExp(`^/comment/${ID}$`, "i")], // edit a comment
  ["POST", new RegExp(`^/sig/${ID}/join$`, "i")],
  ["POST", new RegExp(`^/event/${ID}/rsvp$`, "i")],
  ["POST", new RegExp(`^/feedback/${ID}$`, "i")], // edit feedback
];

/** Whether a muted user is refused this request. */
export function isMuteRestricted(method: string, originalUrl: string) {
  const path = (originalUrl.split("?")[0] || "/").replace(/(.)\/+$/, "$1");
  return MUTE_RESTRICTED.some(
    ([routeMethod, pattern]) =>
      routeMethod === method.toUpperCase() && pattern.test(path),
  );
}

/**
 * The user's own document for /login, /user/me and POST /user: `suspension`
 * only while it is in force.
 */
export function withActiveSuspension<T extends object>(doc: T) {
  if (!doc) return doc;
  const plain: Record<string, unknown> =
    typeof (doc as any).toJSON === "function"
      ? (doc as any).toJSON()
      : { ...doc };
  const active = activeSuspension(plain.suspension);
  if (active) plain.suspension = suspensionView(active);
  else delete plain.suspension;
  return plain as T;
}

const TAIPEI = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "2026/11/20 18:00" in Asia/Taipei. */
export function taipeiTime(date: Date) {
  return TAIPEI.format(date);
}

const LABELS: Record<SuspensionType, string> = { mute: "禁言", ban: "停權" };

/** The `system` notification text for a new or lifted suspension. */
export function suspensionNotice(
  suspension: Pick<Suspension, "type" | "until" | "reason">,
  lifted = false,
) {
  const label = LABELS[suspension.type];
  if (lifted) {
    return {
      title: `你的帳號已解除${label}`,
      message: `你的帳號已解除${label}，可以正常使用了。`,
    };
  }
  const until = suspension.until
    ? `至 ${taipeiTime(new Date(suspension.until))}（台北時間）`
    : "，沒有結束時間";
  return {
    title: `你的帳號已被${label}`,
    message: `你的帳號已被${label}${until}。原因：${suspension.reason}`,
  };
}
