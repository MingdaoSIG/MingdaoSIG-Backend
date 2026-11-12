import { Sig } from "@type/sig";
import { User } from "@type/user";

export const ANNOUNCEMENT_SIG_ID = "652d60b842cdf6a660c2b778"; // 公告
export const USER_PERMISSION = 1;
export const ADMIN_PERMISSION = 2;
/** 內容管理員: moderates posts, comments, reports and mutes users. */
export const CONTENT_MODERATOR_PERMISSION = 3;

/**
 * The site-wide roles (contract v4 §5.2). "moderator" is the content
 * moderator (permission 3), not a SIG moderator (指導老師).
 */
export const ROLES = ["user", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_PERMISSIONS: Record<Role, number> = {
  user: USER_PERMISSION,
  moderator: CONTENT_MODERATOR_PERMISSION,
  admin: ADMIN_PERMISSION,
};

export function isAdmin(user?: Pick<User, "permission"> | null) {
  return user?.permission === ADMIN_PERMISSION;
}

/** A content moderator (permission 3) or an admin. */
export function isContentModerator(user?: Pick<User, "permission"> | null) {
  return user?.permission === CONTENT_MODERATOR_PERMISSION || isAdmin(user);
}

/** The role for a permission value; anything unknown (0, missing) is a user. */
export function roleOf(user?: { permission?: unknown } | null): Role {
  if (user?.permission === ADMIN_PERMISSION) return "admin";
  if (user?.permission === CONTENT_MODERATOR_PERMISSION) return "moderator";
  return "user";
}

export function permissionForRole(role: Role) {
  return ROLE_PERMISSIONS[role];
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
