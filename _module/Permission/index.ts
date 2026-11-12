import { Sig } from "@type/sig";
import { User } from "@type/user";

export const ANNOUNCEMENT_SIG_ID = "652d60b842cdf6a660c2b778"; // 公告
export const ADMIN_PERMISSION = 2;

export function isAdmin(user?: User | null) {
  return user?.permission === ADMIN_PERMISSION;
}

export function isSigLeader(sig: Sig, userId: string) {
  return Boolean(sig.leader?.includes(userId));
}

export function isSigModerator(sig: Sig, userId: string) {
  return Boolean(sig.moderator?.includes(userId));
}

/** A SIG manager is a leader or a moderator (指導老師) of that SIG. */
export function isSigManager(sig: Sig, userId: string) {
  return isSigLeader(sig, userId) || isSigModerator(sig, userId);
}

/**
 * Whether `user` may manage `sig` (edit it, list or remove its members,
 * decide its join requests): an admin, or a manager of that SIG. Without a
 * SIG only an admin may.
 */
export function canManageSig(
  user: User | null | undefined,
  sig: Sig | null | undefined,
) {
  if (isAdmin(user)) return true;
  if (!user?._id || !sig) return false;
  return isSigManager(sig, String(user._id));
}

/** MongoDB filter for the SIGs that `userId` manages. */
export function managedSigsFilter(userId: string) {
  return { $or: [{ leader: userId }, { moderator: userId }] };
}

/**
 * Whether a user may publish a post in `sig` (creating one, or moving an
 * existing post into it).
 *
 * - Admins may post anywhere.
 * - The announcement SIG only accepts its own moderators.
 * - Other SIGs accept their members and leaders. Moderators (advisors) of any
 *   SIG keep the access they had before; scoping advisors is an open product
 *   question.
 */
export function canPostToSig(
  user: User | null | undefined,
  userId: string,
  sig: Sig,
  sigList: Sig[],
) {
  if (isAdmin(user)) return true;

  const sigId = String(sig._id);
  if (sigId === ANNOUNCEMENT_SIG_ID) return isSigModerator(sig, userId);

  const isMember = Boolean(user?.sig?.includes(sigId));
  const isAnyModerator = sigList.some((item) => isSigModerator(item, userId));

  return isMember || isSigLeader(sig, userId) || isAnyModerator;
}
