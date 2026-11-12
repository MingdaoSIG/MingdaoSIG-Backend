import { activityOf, SigActivity } from "@module/SigActivity";
import { followerCount, isFollowedBy } from "@module/SigFollow";

/**
 * Public SIG fields added for the user-side redesign (API contract v4 §6):
 * what GET /sig/list, GET /sig/:id, GET /sig/@:customId, the unified search
 * and the cross-SIG event list show about a SIG.
 *
 * `color`, `defaultCover` and `recruiting` are SIG settings (§3.7, §5.6).
 * They are read from the document as stored, with the documented defaults
 * when a field is missing; nothing here writes them.
 */

export type SigRecruiting = {
  open: boolean;
  message: string;
  until: string | null;
};

type SigLike = Record<string, any>;

/** The SIG's accent colour (#rrggbb), or "" when none is stored. */
export function sigColorOf(sigData: SigLike | null | undefined): string {
  return typeof sigData?.color === "string" ? sigData.color : "";
}

/** The SIG's default post cover (an image id), or "" when none is stored. */
export function sigDefaultCoverOf(sigData: SigLike | null | undefined) {
  return typeof sigData?.defaultCover === "string" ? sigData.defaultCover : "";
}

/** The SIG's recruiting settings; missing ones mean open, "", no end date. */
export function sigRecruitingOf(
  sigData: SigLike | null | undefined,
): SigRecruiting {
  const recruiting = sigData?.recruiting ?? {};
  const until = recruiting.until ? new Date(recruiting.until) : null;
  return {
    open: recruiting.open !== false,
    message: typeof recruiting.message === "string" ? recruiting.message : "",
    until: until && !Number.isNaN(until.getTime()) ? until.toISOString() : null,
  };
}

function toPlain(doc: any): SigLike {
  return typeof doc?.toJSON === "function" ? doc.toJSON() : { ...doc };
}

/**
 * A SIG as the public reads return it: the stored fields without the
 * follower ids (private) and the Discord webhook, plus `color`,
 * `defaultCover`, `recruiting`, `memberCount`, `followerCount` and
 * `latestPostAt`. `followedByMe` is added when `viewerId` is given (the
 * request carried a valid JWT).
 */
export function toPublicSig(
  doc: any,
  activity: Map<string, SigActivity>,
  viewerId?: string | null,
) {
  const { follower, discordWebhook: _webhook, ...rest } = toPlain(doc);
  const { memberCount, latestPostAt } = activityOf(activity, rest._id);
  const data: SigLike = {
    ...rest,
    color: sigColorOf(rest),
    defaultCover: sigDefaultCoverOf(rest),
    recruiting: sigRecruitingOf(rest),
    memberCount,
    followerCount: followerCount({ follower }),
    latestPostAt,
  };
  if (viewerId) data.followedByMe = isFollowedBy({ follower }, viewerId);
  return data;
}
