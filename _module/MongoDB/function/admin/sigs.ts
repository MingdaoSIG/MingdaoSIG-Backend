import { Filter } from "@type/database";
import sig from "@schema/sig";
import user from "@schema/user";
import joinRequest from "@schema/joinRequest";
import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const LIST_FIELDS = {
  name: 1,
  customId: 1,
  avatar: 1,
  description: 1,
  leader: 1,
  moderator: 1,
} as const;

/** SIGs matching the filter (admin SIG list fields), in creation order. */
export async function listSigs(filter: Filter) {
  try {
    return (await sig
      .find(filter, LIST_FIELDS)
      .sort({ _id: 1 })
      .lean()) as any[];
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }
}

/** Ids of the SIGs matching the filter (removed ones included). */
export async function sigIds(filter: Filter) {
  try {
    const docs = await sig.find(filter, { _id: 1 }).lean();
    return docs.map((doc) => String(doc._id));
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }
}

/** Number of users with each SIG in `user.sig`, keyed by SIG id. */
export async function memberCounts(ids: string[]) {
  try {
    const counts: Record<string, number> = {};
    if (ids.length === 0) return counts;

    const groups: { _id: string; count: number }[] = await user.aggregate([
      { $match: { sig: { $in: ids } } },
      { $project: { sig: 1 } },
      { $unwind: "$sig" },
      { $match: { sig: { $in: ids } } },
      // A user listing a SIG twice is still one member.
      { $group: { _id: { sig: "$sig", user: "$_id" } } },
      { $group: { _id: "$_id.sig", count: { $sum: 1 } } },
    ]);
    for (const group of groups) counts[String(group._id)] = group.count;
    return counts;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/** Number of pending join requests for each SIG, keyed by SIG id. */
export async function pendingJoinRequestCounts(ids: string[]) {
  try {
    const counts: Record<string, number> = {};
    if (ids.length === 0) return counts;

    const groups: { _id: string; count: number }[] =
      await joinRequest.aggregate([
        { $match: { sig: { $in: ids }, removed: false, state: "pending" } },
        { $group: { _id: "$sig", count: { $sum: 1 } } },
      ]);
    for (const group of groups) counts[String(group._id)] = group.count;
    return counts;
  } catch (error) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error,
    );
  }
}

export async function imageExists(id: string) {
  try {
    return Boolean(await image.exists({ _id: id }));
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_IMAGE_FROM_DB, error);
  }
}
