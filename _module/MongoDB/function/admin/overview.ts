import user from "@schema/user";
import post from "@schema/post";
import comment from "@schema/comment";
import sig from "@schema/sig";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const SIG_FIELDS = { _id: 1, name: 1, customId: 1 } as const;
const RECENT_POST_FIELDS = { title: 1, sig: 1, user: 1, createdAt: 1 } as const;
const RECENT_POSTS = 5;

/**
 * The numbers on the admin overview. Users have no `removed` flag, so every
 * user counts; posts, comments, join requests and SIGs count only when they
 * are not removed. `since` is the start of the "last 7 days" window.
 */
export default async function overview(since: Date) {
  try {
    const recent = { $gte: since };
    const pending = { removed: false, state: "pending" };

    const [
      usersTotal,
      usersLast7d,
      postsTotal,
      postsLast7d,
      commentsTotal,
      commentsLast7d,
      pendingTotal,
      oldestPending,
      sigsWithoutLeader,
      sigsWithoutModerator,
      recentPosts,
    ] = await Promise.all([
      user.countDocuments({}),
      user.countDocuments({ createdAt: recent }),
      post.countDocuments({ removed: false }),
      post.countDocuments({ removed: false, createdAt: recent }),
      comment.countDocuments({ removed: false }),
      comment.countDocuments({ removed: false, createdAt: recent }),
      joinRequest.countDocuments(pending),
      joinRequest
        .findOne(pending, { createdAt: 1 })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      // "leader.0" does not exist: the array is missing, null or empty.
      sig
        .find({ removed: false, "leader.0": { $exists: false } }, SIG_FIELDS)
        .sort({ _id: 1 })
        .lean(),
      sig
        .find({ removed: false, "moderator.0": { $exists: false } }, SIG_FIELDS)
        .sort({ _id: 1 })
        .lean(),
      post
        .find({ removed: false }, RECENT_POST_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .limit(RECENT_POSTS)
        .lean(),
    ]);

    return {
      usersTotal,
      usersLast7d,
      postsTotal,
      postsLast7d,
      commentsTotal,
      commentsLast7d,
      pendingTotal,
      oldestPendingCreatedAt: (oldestPending as any)?.createdAt ?? null,
      sigsWithoutLeader: sigsWithoutLeader as any[],
      sigsWithoutModerator: sigsWithoutModerator as any[],
      recentPosts: recentPosts as any[],
    };
  } catch (error) {
    throw new CustomError(CustomStatus.UNKNOWN_ERROR, error);
  }
}
