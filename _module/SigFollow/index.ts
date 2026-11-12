import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { ANNOUNCEMENT_SIG_ID } from "@module/Permission";

/**
 * Following a SIG (API contract v4 §6.1), stored in the `sig.follower` array
 * of user ids. Following never makes anyone a member: it only adds the SIG's
 * posts to the follower's my-SIG feed and its events to the "mine" event
 * list. Who follows a SIG is private, so SIG reads return `followerCount`
 * instead of the array.
 */

type Followable = { _id?: unknown; removed?: boolean | null };

/**
 * Whether a SIG may be followed: any SIG that is not archived, and the
 * announcement SIG, which is stored with `removed: true` on purpose.
 */
export function canFollow(sigData: Followable) {
  return !sigData.removed || String(sigData._id) === ANNOUNCEMENT_SIG_ID;
}

/** Number of distinct followers in a SIG document's `follower` array. */
export function followerCount(sigData: { follower?: unknown }) {
  const list = Array.isArray(sigData.follower) ? sigData.follower : [];
  return new Set(list.map(String)).size;
}

/** Whether `userId` follows the SIG. */
export function isFollowedBy(sigData: { follower?: unknown }, userId: string) {
  return (
    Array.isArray(sigData.follower) &&
    sigData.follower.map(String).includes(userId)
  );
}

/** Ids of the SIGs the user follows (archived ones included). */
export async function followedSigIds(userId: string) {
  try {
    const docs = await sig.find({ follower: userId }, { _id: 1 }).lean();
    return docs.map((doc) => String(doc._id));
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }
}

/**
 * Adds the user to the SIG's followers (or removes them), idempotently.
 * Returns the follower count afterwards, or null when the SIG is gone.
 */
export async function setFollowed(
  sigId: string,
  userId: string,
  followed: boolean,
) {
  try {
    const update = followed
      ? { $addToSet: { follower: userId } }
      : // Also clears any duplicate entries of the user.
        { $pull: { follower: userId } };
    const updated = await sig
      .findOneAndUpdate({ _id: sigId }, update, { returnDocument: "after" })
      .select({ follower: 1 })
      .lean();
    return updated ? followerCount(updated) : null;
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_WRITING_SIG_TO_DB, error);
  }
}
