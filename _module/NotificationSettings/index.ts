import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { NotificationType } from "@module/Notify";

/**
 * Per-user notification settings (`user.notificationSettings`, contract v4
 * §2.2). Missing keys mean the defaults below, so only what the user changed
 * is stored.
 *
 * `email.comment` is the older `notifyComments` field (the comment emails
 * still read that one): reading falls back to it, and every write updates
 * both.
 */

export const PUSH_SETTING_TYPES = [
  "comment",
  "reply",
  "like",
  "join_request",
  "join_result",
  "feedback",
  "event",
] as const satisfies readonly NotificationType[];

export const EMAIL_SETTING_TYPES = ["comment", "digest"] as const;

export type PushSettingType = (typeof PUSH_SETTING_TYPES)[number];
export type EmailSettingType = (typeof EMAIL_SETTING_TYPES)[number];

export type NotificationSettings = {
  push: Record<PushSettingType, boolean>;
  email: Record<EmailSettingType, boolean>;
};

/** What is stored: any subset of the settings. */
export type StoredNotificationSettings = {
  push?: Partial<Record<PushSettingType, boolean>>;
  email?: Partial<Record<EmailSettingType, boolean>>;
};

const CHANNELS = {
  push: PUSH_SETTING_TYPES,
  email: EMAIL_SETTING_TYPES,
} as const;

// The weekly digest is opt-in (owner's decision); everything else is on.
const DEFAULT_EMAIL: Record<EmailSettingType, boolean> = {
  comment: true,
  digest: false,
};

type UserWithSettings = {
  notificationSettings?: StoredNotificationSettings | null;
  notifyComments?: boolean | null;
};

/** The user's settings merged with the defaults. */
export function resolveNotificationSettings(
  user: UserWithSettings | null | undefined,
): NotificationSettings {
  const stored = user?.notificationSettings ?? {};
  const push = {} as Record<PushSettingType, boolean>;
  for (const type of PUSH_SETTING_TYPES) {
    push[type] = pick(stored.push?.[type], true);
  }

  const notifyComments =
    typeof user?.notifyComments === "boolean" ? user.notifyComments : true;
  return {
    push,
    email: {
      comment: pick(stored.email?.comment, notifyComments),
      digest: pick(stored.email?.digest, DEFAULT_EMAIL.digest),
    },
  };
}

/** Whether a stored notification of `type` may be pushed to this user. */
export function allowsPush(
  user: UserWithSettings | null | undefined,
  type: string,
) {
  return user?.notificationSettings?.push?.[type as PushSettingType] !== false;
}

/**
 * The user document as a plain object with `notificationSettings` merged
 * with the defaults, for the responses that return the user's own document
 * (/login, /user/me, POST /user).
 */
export function withNotificationSettings<T extends object>(user: T) {
  if (!user) return user;
  const plain =
    typeof (user as any).toJSON === "function"
      ? (user as any).toJSON()
      : { ...user };
  return {
    ...plain,
    notificationSettings: resolveNotificationSettings(user as any),
  } as T & { notificationSettings: NotificationSettings };
}

/**
 * Checks a partial `notificationSettings` from a request body and returns
 * the update for it, as dotted paths (a deep merge into what is stored).
 * Only the known keys with boolean values are allowed; anything else is
 * 400/4011.
 */
export function notificationSettingsUpdate(
  value: unknown,
): Record<string, boolean> {
  if (!isPlainObject(value)) invalid("notificationSettings must be an object");

  const update: Record<string, boolean> = {};
  for (const [channel, settings] of Object.entries(value)) {
    if (channel !== "push" && channel !== "email")
      invalid(`notificationSettings.${channel} is not a setting`);
    const allowed: readonly string[] = CHANNELS[channel];

    if (!isPlainObject(settings))
      invalid(`notificationSettings.${channel} must be an object`);
    for (const [key, enabled] of Object.entries(settings)) {
      if (!allowed.includes(key))
        invalid(`notificationSettings.${channel}.${key} is not a setting`);
      if (typeof enabled !== "boolean")
        invalid(`notificationSettings.${channel}.${key} must be true or false`);
      update[`notificationSettings.${channel}.${key}`] = enabled;
    }
  }
  return update;
}

function pick(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function invalid(message: string): never {
  throw new CustomError(CustomStatus.INVALID_BODY, new Error(message));
}
