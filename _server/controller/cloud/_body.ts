import { Request } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { fail } from "./admin/_shared";

/**
 * The JSON body as an object that has every `required` key and no key
 * outside `allowed`; 400/4011 otherwise. With `nonEmpty`, at least one key.
 */
export function objectBody(
  req: Request,
  allowed: readonly string[],
  {
    required = [],
    nonEmpty = false,
  }: { required?: string[]; nonEmpty?: boolean } = {},
) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");

  const keys = Object.keys(body);
  const extra = keys.filter((key) => !allowed.includes(key));
  if (extra.length > 0)
    fail(CustomStatus.INVALID_BODY, `Unknown field(s): ${extra.join(", ")}`);

  const missing = required.filter((key) => !keys.includes(key));
  if (missing.length > 0)
    fail(CustomStatus.INVALID_BODY, `Missing field(s): ${missing.join(", ")}`);

  if (nonEmpty && keys.length === 0)
    fail(
      CustomStatus.INVALID_BODY,
      `Send at least one of: ${allowed.join(", ")}`,
    );

  return body as Record<string, unknown>;
}

/** A string of at most `max` characters (Unicode code points). */
export function boundedString(
  value: unknown,
  name: string,
  max: number,
  { trim = false, min = 0 }: { trim?: boolean; min?: number } = {},
) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${name} must be a string`);
  const text = trim ? value.trim() : value;
  const length = Array.from(text).length;
  if (length < min || length > max)
    fail(
      CustomStatus.INVALID_BODY,
      min > 0
        ? `${name} must be ${min} to ${max} characters`
        : `${name} must be at most ${max} characters`,
    );
  return text;
}

const OBJECT_ID_HEX = /^[0-9a-f]{24}$/i;

/**
 * An id as stored: 24 hex digits, lower case. Stricter than isValidObjectId,
 * which also takes any 12-character string.
 */
export function storedId(value: unknown, name: string) {
  if (typeof value !== "string" || !OBJECT_ID_HEX.test(value))
    fail(CustomStatus.INVALID_BODY, `${name} must be an id`);
  return value.toLowerCase();
}

/** An array of distinct ids (see storedId). */
export function idList(value: unknown, name: string) {
  if (!Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, `${name} must be an array of ids`);
  const ids = value.map((id) => storedId(id, `${name} item`));
  if (new Set(ids).size !== ids.length)
    fail(CustomStatus.INVALID_BODY, `${name} must not repeat an id`);
  return ids;
}

export const LINK_MAX = 500;

/**
 * An optional link: "" (none, also for null or a missing value), a site
 * path ("/post/…", not "//host") or an https URL; at most 500 characters.
 */
export function linkValue(value: unknown, name = "link") {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${name} must be a string`);
  const link = value.trim();
  const invalid = () =>
    fail(
      CustomStatus.INVALID_BODY,
      `${name} must be a path starting with / or an https URL`,
    );
  if (link.length > LINK_MAX || /[\s\\]/.test(link)) invalid();
  if (link.startsWith("/")) {
    if (link.startsWith("//")) invalid();
    return link;
  }
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || !url.hostname || url.username) invalid();
  } catch {
    invalid();
  }
  return link;
}

/** An ISO date string as a Date; 400/4011 otherwise. */
export function dateValue(value: unknown, name: string) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${name} must be an ISO date`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    fail(CustomStatus.INVALID_BODY, `${name} must be an ISO date`);
  return date;
}
