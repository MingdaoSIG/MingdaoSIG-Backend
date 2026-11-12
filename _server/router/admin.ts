import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import adminOnly from "@middleware/adminOnly";
import contentModeratorOnly from "@middleware/contentModeratorOnly";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { overview } from "@controller/cloud/admin/overview";
import {
  batchPosts,
  listPosts,
  pinPost,
  removePost,
  restorePost,
} from "@controller/cloud/admin/posts";
import {
  listUsers,
  readUser,
  setBadges,
  setPermission,
} from "@controller/cloud/admin/users";
import {
  listComments,
  removeComment,
  restoreComment,
} from "@controller/cloud/admin/comments";
import { suspend, unsuspend } from "@controller/cloud/admin/suspension";
import { listAllLogins, listUserLogins } from "@controller/cloud/admin/logins";
import { broadcast } from "@controller/cloud/admin/broadcast";
import { traffic } from "@controller/cloud/admin/traffic";
import {
  readKeywordFilter,
  writeKeywordFilter,
} from "@controller/cloud/admin/keywordFilter";
import {
  createBanner,
  editBanner,
  listBanners,
  removeBanner,
} from "@controller/cloud/admin/banners";
import { listSigs } from "@controller/cloud/admin/sigs";
import { createSig } from "@controller/cloud/admin/sigCreate";
import { updateUser } from "@controller/cloud/admin/userEdit";
import {
  listAdminBadges,
  retireBadge,
  saveBadge,
} from "@controller/cloud/admin/badges";
import {
  applyRolloverHandler,
  batchLeaders,
  mergeSig,
  movePostsHandler,
  previewRollover,
} from "@controller/cloud/admin/sigOps";
import { decide, listJoinRequests } from "@controller/cloud/admin/joinRequests";
import { listAuditEntries } from "@controller/cloud/admin/audit";
import { listReports, resolveReport } from "@controller/cloud/admin/reports";
import {
  listIssueReports,
  readIssueReport,
  updateIssueReport,
} from "@controller/cloud/admin/issueReports";
import { previewDigest } from "@controller/cloud/admin/digest";

// Admin panel API (contract v3 §3, v4 §5). Every route needs a JWT; GETs
// use the read tier and everything else the write tier. contentModeratorOnly
// routes are open to content moderators (permission 3) and admins (v4 §5.2).
// Routes without either are also open to SIG managers and scope the result
// themselves.
const admin: Router = Router();

admin.use(rateLimiter(RateLimiterOption.BY_METHOD));
admin.use(JWTverifier);

// Content moderators get the posts, comments and open-report numbers only.
admin.get("/overview", contentModeratorOnly, overview);
admin.get("/traffic", adminOnly, traffic);

admin.get("/posts", contentModeratorOnly, listPosts);
admin.post("/posts/batch", contentModeratorOnly, batchPosts);
admin.post("/posts/move", adminOnly, movePostsHandler);
admin.post("/posts/:id/pin", contentModeratorOnly, pinPost);
admin.post("/posts/:id/remove", contentModeratorOnly, removePost);
admin.post("/posts/:id/restore", contentModeratorOnly, restorePost);

admin.get("/users", contentModeratorOnly, listUsers);
admin.get("/users/:id", contentModeratorOnly, readUser);
admin.post("/users/:id", adminOnly, updateUser);
// Content moderators may mute (and lift mutes), never ban (v4 §5.1).
admin.post("/users/:id/suspend", contentModeratorOnly, suspend);
admin.post("/users/:id/unsuspend", contentModeratorOnly, unsuspend);
admin.post("/users/:id/permission", adminOnly, setPermission);
admin.get("/users/:id/logins", adminOnly, listUserLogins);
admin.post("/users/:id/badges", adminOnly, setBadges);

admin.get("/comments", contentModeratorOnly, listComments);
admin.post("/comments/:id/remove", contentModeratorOnly, removeComment);
admin.post("/comments/:id/restore", contentModeratorOnly, restoreComment);

admin.post("/sigs", adminOnly, createSig);
admin.post("/sigs/leaders/batch", adminOnly, batchLeaders);
admin.post("/sigs/:id/merge", adminOnly, mergeSig);

admin.get("/rollover/preview", adminOnly, previewRollover);
admin.post("/rollover/apply", adminOnly, applyRolloverHandler);

// Admin, or SIG manager (scoped)
admin.get("/sigs", listSigs);
admin.post("/broadcast", broadcast);
admin.get("/join-requests", listJoinRequests);
admin.post("/join-requests/:id/decision", decide);

admin.get("/audit", adminOnly, listAuditEntries);
admin.get("/logins", adminOnly, listAllLogins);

admin.get("/banners", adminOnly, listBanners);
admin.post("/banners", adminOnly, createBanner);
admin.post("/banners/:id", adminOnly, editBanner);
admin.delete("/banners/:id", adminOnly, removeBanner);

admin.get("/keyword-filter", adminOnly, readKeywordFilter);
admin.post("/keyword-filter", adminOnly, writeKeywordFilter);

admin.get("/reports", contentModeratorOnly, listReports);
admin.post("/reports/:id/resolve", contentModeratorOnly, resolveReport);

admin.get("/issue-reports", adminOnly, listIssueReports);
admin.get("/issue-reports/:id", adminOnly, readIssueReport);
admin.post("/issue-reports/:id", adminOnly, updateIssueReport);

admin.get("/badges", adminOnly, listAdminBadges);
admin.post("/badges", adminOnly, saveBadge);
admin.delete("/badges", adminOnly, retireBadge);
admin.delete("/badges/:key", adminOnly, retireBadge);

admin.post("/digest/preview", adminOnly, previewDigest);

export default admin;
