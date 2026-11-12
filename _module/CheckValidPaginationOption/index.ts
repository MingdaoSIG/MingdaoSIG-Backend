import { Request } from "express";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const MAX_LIMIT = 50;

export default function CheckValidPaginationOption(
  req: Request | ExtendedRequest,
) {
  const skip = req.query?.skip;
  const limit = req.query?.limit;

  // ! Without skip and limit the caller gets every item. The admin post page
  // ! (GET /post/list with no query) depends on this. Remove once it paginates.
  if (skip === undefined && limit === undefined) return true;

  // Each value that is present is checked on its own, so sending only
  // `limit` can no longer get past the cap.
  if (skip !== undefined) toNonNegativeInteger(skip, "Skip");

  if (limit !== undefined) {
    const value = toNonNegativeInteger(limit, "Limit");
    if (value <= 0 || value > MAX_LIMIT)
      throw new CustomError(
        CustomStatus.INVALID_QUERY,
        new Error("Limit should be above 0 and less than 50"),
      );
  }

  return true;
}

function toNonNegativeInteger(value: unknown, name: string) {
  if (typeof value !== "string")
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error(`${name} is not a string`),
    );

  if (!/^\d+$/.test(value))
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error(`${name} is not a non-negative integer`),
    );

  return Number(value);
}
