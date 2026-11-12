import { isValidObjectId } from "mongoose";

import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { sigColor, sigDefaultCover } from "@module/SigDefaults";

/**
 * Validation of the SIG fields set through `POST /sig/:id` and
 * `POST /admin/sigs`, and the SIG shape the read routes return
 * (API contract v3 §3.5, v4 §3.7).
 */

export const SIG_NAME_MAX_LENGTH = 30;
export const SIG_DESCRIPTION_MAX_LENGTH = 250;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function invalid(status: number, message: string): never {
  throw new CustomError(status, new Error(message));
}

/** 1 to 30 characters after trimming. */
export function parseSigName(value: unknown) {
  if (typeof value !== "string")
    invalid(CustomStatus.INVALID_BODY, "name must be a string");
  const name = value.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > SIG_NAME_MAX_LENGTH)
    invalid(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `name must be 1 to ${SIG_NAME_MAX_LENGTH} characters`,
    );
  return name;
}

/** At most 250 characters. */
export function parseSigDescription(value: unknown) {
  if (typeof value !== "string")
    invalid(CustomStatus.INVALID_BODY, "description must be a string");
  if (value.length > SIG_DESCRIPTION_MAX_LENGTH)
    invalid(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `description must be at most ${SIG_DESCRIPTION_MAX_LENGTH} characters`,
    );
  return value;
}

/** "#rrggbb", stored lowercased. */
export function parseSigColor(value: unknown) {
  if (typeof value !== "string" || !COLOR_PATTERN.test(value))
    invalid(CustomStatus.INVALID_BODY, "color must be #rrggbb");
  return value.toLowerCase();
}

/** The id of an existing image (from POST /image); 4016 otherwise. */
export async function parseImageId(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !isValidObjectId(value) ||
    !(await image.exists({ _id: value }))
  )
    invalid(CustomStatus.INVALID_IMAGE_ID, `${field} must be an image id`);
  return value;
}

/** A boolean; 4011 otherwise. */
export function parseBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean")
    invalid(CustomStatus.INVALID_BODY, `${field} must be true or false`);
  return value;
}

/**
 * A SIG as the read routes return it: the stored document with `color` and
 * `defaultCover` resolved (the SIG's own value, else the old hardcoded one,
 * else "").
 */
export function toSigResponse(doc: any): Record<string, any> {
  const plain =
    typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    ...plain,
    color: sigColor(plain),
    defaultCover: sigDefaultCover(plain),
  };
}
