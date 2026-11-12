import { activityOf, SigActivity } from "@module/SigActivity";
import { sigColor, sigDefaultCover } from "@module/SigDefaults";
import { followerCount, isFollowedBy } from "@module/SigFollow";
import { resolveRecruiting, toSigResponse } from "@module/SigSettings";

/**
 * Public SIG fields added for the user-side redesign (API contract v4 §6):
 * what GET /sig/list, GET /sig/:id, GET /sig/@:customId, the unified search
 * and the cross-SIG event list show about a SIG.
 *
 * `color`, `defaultCover` and `recruiting` are the SIG settings of §3.7 and
 * §5.6, resolved by @module/SigDefaults and @module/SigSettings (the SIG's
 * own value, else the old hardcoded one or the default).
 */

type SigLike = Record<string, any>;

/** The SIG's accent colour (#rrggbb), or "". */
export function sigColorOf(sigData: SigLike | null | undefined): string {
  return sigColor(sigData) ?? "";
}

/** The SIG's default post cover (an image id), or "". */
export function sigDefaultCoverOf(sigData: SigLike | null | undefined) {
  return sigDefaultCover(sigData) ?? "";
}

/** The SIG's recruiting settings; missing ones mean open, "", no end date. */
export function sigRecruitingOf(sigData: SigLike | null | undefined) {
  return resolveRecruiting(sigData ?? {});
}

/**
 * A SIG as the public reads return it: the stored fields with the settings
 * resolved (see toSigResponse), without the follower ids (private), plus
 * `memberCount`, `followerCount` and `latestPostAt`. `followedByMe` is added
 * when `viewerId` is given (the request carried a valid JWT).
 */
export function toPublicSig(
  doc: any,
  activity: Map<string, SigActivity>,
  viewerId?: string | null,
) {
  const { follower, ...rest } = toSigResponse(doc);
  const { memberCount, latestPostAt } = activityOf(activity, rest._id);
  const data: SigLike = {
    ...rest,
    memberCount,
    followerCount: followerCount({ follower }),
    latestPostAt,
  };
  if (viewerId) data.followedByMe = isFollowedBy({ follower }, viewerId);
  return data;
}
