import { NextFunction, Request, RequestHandler, Response } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import {
  BrowserSubscription,
  pushConfig,
  removeSubscription,
  saveSubscription,
} from "@module/WebPush";
import { callerId, fail, sendError } from "@controller/cloud/admin/_shared";

// Web push subscriptions (contract v4 §2.3).

const MAX_ENDPOINT_LENGTH = 2048;

/**
 * Push services of the browsers that support web push. The server POSTs to
 * a stored endpoint, so any other host is refused (no requests to internal
 * or arbitrary URLs).
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Android, Samsung Internet, Opera, Brave
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari (macOS, iOS 16.4+ home screen apps)
  "notify.windows.com", // Edge
];

/** Answers 503/5000 while the VAPID env vars are missing or invalid. */
export function requirePush(_req: Request, res: Response, next: NextFunction) {
  if (!pushConfig().enabled) {
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      status: CustomStatus.UNKNOWN_ERROR,
      message: "Web push is not configured",
    });
  }
  next();
}

// GET /push/public-key (no auth)
export const publicKey: RequestHandler = (_req, res) => {
  const config = pushConfig();
  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: { publicKey: config.enabled ? config.publicKey : "" },
  });
};

// POST /push/subscribe with the browser's PushSubscription JSON
export const subscribe: RequestHandler = async (req, res) => {
  try {
    const subscription = parseSubscription(req.body);
    await saveSubscription(callerId(req), subscription);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /push/subscribe with { endpoint }
export const unsubscribe: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req.body);
    if (Object.keys(body).some((key) => key !== "endpoint"))
      fail(CustomStatus.INVALID_BODY, "Body must be { endpoint }");
    const endpoint = body.endpoint;
    if (
      typeof endpoint !== "string" ||
      endpoint === "" ||
      endpoint.length > MAX_ENDPOINT_LENGTH
    )
      fail(CustomStatus.INVALID_BODY, "endpoint must be a string");

    const removed = await removeSubscription(callerId(req), endpoint);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { removed },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * `{ endpoint, keys: { p256dh, auth } }` plus the `expirationTime` that
 * PushSubscription.toJSON() adds (ignored). Anything else is 400/4011.
 */
function parseSubscription(value: unknown): BrowserSubscription {
  const body = objectBody(value);
  if (
    Object.keys(body).some(
      (key) => !["endpoint", "keys", "expirationTime"].includes(key),
    )
  )
    fail(CustomStatus.INVALID_BODY, "Body must be a PushSubscription");

  const { endpoint, keys, expirationTime } = body as Record<string, any>;
  if (
    expirationTime !== undefined &&
    expirationTime !== null &&
    typeof expirationTime !== "number"
  )
    fail(CustomStatus.INVALID_BODY, "expirationTime must be a number or null");

  if (!isPushServiceEndpoint(endpoint))
    fail(
      CustomStatus.INVALID_BODY,
      "endpoint must be an https URL of a browser push service",
    );

  const keyObject = objectBody(keys, "keys must be an object");
  if (
    Object.keys(keyObject).length !== 2 ||
    !isBase64UrlKey(keyObject.p256dh, 65) ||
    !isBase64UrlKey(keyObject.auth, 16)
  )
    fail(CustomStatus.INVALID_BODY, "keys must be { p256dh, auth }");

  return {
    endpoint,
    keys: { p256dh: keyObject.p256dh, auth: keyObject.auth },
  };
}

function isPushServiceEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ENDPOINT_LENGTH)
    return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

// A URL-safe base64 key (padding allowed) of exactly `bytes` bytes.
function isBase64UrlKey(value: unknown, bytes: number): value is string {
  if (typeof value !== "string" || value.length > 200) return false;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, "base64url").length === bytes;
}

function objectBody(value: unknown, message = "Body must be a JSON object") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, message);
  return value as Record<string, any>;
}
