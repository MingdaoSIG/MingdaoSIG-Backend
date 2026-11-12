import { SortOrder } from "mongoose";

import { Filter } from "@type/database";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

// Never the confirmId: it accepts or rejects the request without a login.
const LIST_FIELDS = {
  user: 1,
  sig: 1,
  q1: 1,
  q2: 1,
  q3: 1,
  state: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

/** One page of join requests and the total for the same filter. */
export async function listJoinRequests(
  filter: Filter,
  option: { skip: number; limit: number; sort: Record<string, SortOrder> },
) {
  try {
    const [data, total] = await Promise.all([
      joinRequest
        .find(filter, LIST_FIELDS)
        .sort(option.sort)
        .skip(option.skip)
        .limit(option.limit)
        .lean(),
      joinRequest.countDocuments(filter),
    ]);
    return { data: data as any[], total };
  } catch (error) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error,
    );
  }
}
