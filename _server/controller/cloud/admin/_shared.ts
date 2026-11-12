import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomCode, CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";

// Shared request parsing and error responses for the /admin routes and the
// SIG management routes built with them (API contract v3, §1 and §3).

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const MAX_QUERY_LENGTH = 100;

/** Throws a CustomError with `message`, for the error response. */
export function fail(status: number, message: string): never {
  throw new CustomError(status, new Error(message));
}

// The HTTP status that goes with a custom status code (contract §1).
function httpStatusFor(code: number) {
  switch (code) {
    case CustomStatus.INVALID_JWT:
      return HttpStatus.UNAUTHORIZED;
    case CustomStatus.FORBIDDEN:
      return HttpStatus.FORBIDDEN;
    case CustomStatus.NOT_FOUND:
    case CustomStatus.INVALID_QUERY:
      return HttpStatus.NOT_FOUND;
    case CustomStatus.TOO_MANY_REQUESTS:
      return HttpStatus.TOO_MANY_REQUESTS;
  }
  // 40xx: something about the request; 41xx (database) and 5000: ours.
  if (code >= 4000 && code < 4100) return HttpStatus.BAD_REQUEST;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Sends `{ status, message }` for an error thrown by a handler. Request
 * errors carry their own message; database and unknown errors are logged
 * and answered with the generic text only.
 */
export function sendError(res: Response, error: unknown) {
  const code =
    error instanceof CustomError && error.statusCode
      ? error.statusCode
      : CustomStatus.UNKNOWN_ERROR;
  const httpStatus = httpStatusFor(code);

  let message: string | undefined;
  if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
    const cause = error instanceof CustomError ? error.error : error;
    console.error(
      `Admin : ${res.req?.method} ${res.req?.baseUrl}${res.req?.path} failed:`,
      cause instanceof Error ? cause.message : cause,
    );
  } else if (error instanceof CustomError && error.error instanceof Error) {
    message = error.error.message;
  }

  return res.status(httpStatus).json({
    status: code,
    message: message || CustomCode[code as keyof typeof CustomCode],
  });
}

/** The caller's user id (JWTverifier has run). */
export function callerId(req: Request) {
  return String((req as unknown as ExtendedRequest).userData._id);
}

export function caller(req: Request) {
  return (req as unknown as ExtendedRequest).userData;
}

/** skip (default 0) and limit (1 to 100, default 50); 4012 otherwise. */
export function pagination(req: Request) {
  CheckValidPaginationOption(req, MAX_LIMIT);
  const { skip, limit } = req.query;
  return {
    skip: skip === undefined ? 0 : Number(skip),
    limit: limit === undefined ? DEFAULT_LIMIT : Number(limit),
  };
}

// One query value as a string, or undefined when it is missing or empty.
// Arrays and objects (?q[]=…, ?q[$ne]=…) are refused.
function queryValue(req: Request, name: string) {
  const value = req.query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_QUERY, `${name} is not a single string`);
  return value === "" ? undefined : value;
}

/** Search text: trimmed, at most 100 characters, "" when absent. */
export function queryText(req: Request, name = "q") {
  const value = (queryValue(req, name) ?? "").trim();
  if (value.length > MAX_QUERY_LENGTH)
    fail(
      CustomStatus.INVALID_QUERY,
      `${name} is longer than ${MAX_QUERY_LENGTH} characters`,
    );
  return value;
}

/** An optional id filter: a valid ObjectId, or undefined when absent. */
export function queryId(req: Request, name: string) {
  const value = queryValue(req, name);
  if (value === undefined) return undefined;
  if (!isValidObjectId(value))
    fail(CustomStatus.INVALID_QUERY, `${name} is not a valid id`);
  return value;
}

/** One of `allowed`, or `fallback` when absent. */
export function queryEnum<T extends string>(
  req: Request,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = queryValue(req, name);
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T))
    fail(
      CustomStatus.INVALID_QUERY,
      `${name} must be one of: ${allowed.join(", ")}`,
    );
  return value as T;
}

/** A path id: a valid ObjectId, otherwise 404/4000. */
export function pathId(req: Request, name = "id") {
  const value = req.params[name];
  if (typeof value !== "string" || !isValidObjectId(value))
    fail(CustomStatus.NOT_FOUND, `Invalid ${name}`);
  return value;
}

/**
 * The JSON body, which must be an object with exactly these keys (each one
 * present); 400/4011 otherwise.
 */
export function exactBody(req: Request, keys: string[]) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");

  const bodyKeys = Object.keys(body);
  const missing = keys.filter((key) => !bodyKeys.includes(key));
  const extra = bodyKeys.filter((key) => !keys.includes(key));
  if (missing.length > 0 || extra.length > 0)
    fail(
      CustomStatus.INVALID_BODY,
      `Body must have exactly: ${keys.join(", ")}`,
    );

  return body as Record<string, unknown>;
}

/** Case-insensitive match of `text` taken literally. */
export function containsPattern(text: string) {
  return { $regex: escapeRegExp(text), $options: "i" };
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
