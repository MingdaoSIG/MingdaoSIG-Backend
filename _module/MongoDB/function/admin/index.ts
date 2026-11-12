// Queries for the admin panel and SIG management: filtered pages with totals,
// counts, and conditional updates that report whether anything changed.
import overview from "./overview";
import { listPosts, setPostFlag, userIdsMatching } from "./posts";
import {
  badgeUserCounts,
  countAdmins,
  listUsers,
  readFullUser,
  readUserProfile,
  removeSigMembership,
  setBadges,
  setPermission,
  updateUserProfile,
  userActivity,
} from "./users";
import { listComments, setCommentRemoved } from "./comments";
import {
  imageExists,
  listSigs,
  memberCounts,
  pendingJoinRequestCounts,
  sigIds,
} from "./sigs";
import { listJoinRequests } from "./joinRequests";
import { postsByIds, sigsByIds, usersByIds } from "./lookup";

export default {
  overview,
  listPosts,
  setPostFlag,
  userIdsMatching,
  badgeUserCounts,
  countAdmins,
  listUsers,
  readFullUser,
  removeSigMembership,
  setBadges,
  setPermission,
  userActivity,
  readUserProfile,
  updateUserProfile,
  listComments,
  setCommentRemoved,
  imageExists,
  listSigs,
  memberCounts,
  pendingJoinRequestCounts,
  sigIds,
  listJoinRequests,
  postsByIds,
  sigsByIds,
  usersByIds,
};
