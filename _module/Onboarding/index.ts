import { isValidObjectId, Types } from "mongoose";

import { User } from "@type/user";
import post from "@schema/post";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { withNotificationSettings } from "@module/NotificationSettings";
import { managedSigsFilter } from "@module/Permission";
import { followedSigIds } from "@module/SigFollow";

/**
 * First-login onboarding (API contract v4 §6.2) and the fields GET /user/me
 * adds for the redesign.
 *
 * `onboardedAt` is stored when the user finishes or skips the onboarding
 * (POST /user `{ onboarded: true }`). A user without it who already took part
 * (at least one post, a SIG membership, a managed SIG or a followed SIG)
 * counts as onboarded since their account was created. This is worked out on
 * every read, not by a migration, and nothing is written for it.
 */

type OnboardingUser = Pick<User, "_id" | "sig"> & {
  onboardedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function toDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

// When the account was created: `createdAt`, else the id's timestamp.
function accountCreatedAt(user: OnboardingUser) {
  const createdAt = toDate(user.createdAt);
  if (createdAt) return createdAt;
  const id = String(user._id);
  return isValidObjectId(id) ? new Types.ObjectId(id).getTimestamp() : null;
}

/**
 * The user's `onboardedAt`: the stored date, else (for users who already
 * took part) the account's creation date, else null.
 */
export async function resolveOnboardedAt(
  user: OnboardingUser,
  followedSigs: string[],
): Promise<Date | null> {
  const stored = toDate(user.onboardedAt);
  if (stored) return stored;

  const userId = String(user._id);
  let tookPart = (user.sig?.length ?? 0) > 0 || followedSigs.length > 0;
  if (!tookPart) {
    try {
      const [managed, posted] = await Promise.all([
        sig.exists(managedSigsFilter(userId)),
        // Any post counts, removed ones too: the user has been active.
        post.exists({ user: userId }),
      ]);
      tookPart = Boolean(managed || posted);
    } catch (error) {
      throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
    }
  }
  return tookPart ? accountCreatedAt(user) : null;
}

/**
 * The caller's own user document as GET /user/me and POST /user return it:
 * notification settings with their defaults, `followedSigs` (ids of the SIGs
 * they follow) and `onboardedAt`.
 */
export async function withOwnUserFields<T extends OnboardingUser>(user: T) {
  const data = withNotificationSettings(user);
  const followedSigs = await followedSigIds(String(user._id));
  const onboardedAt = await resolveOnboardedAt(data, followedSigs);
  return { ...data, followedSigs, onboardedAt };
}
