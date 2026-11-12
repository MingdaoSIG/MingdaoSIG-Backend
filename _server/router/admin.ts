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
import { listSigs } from "@controller/cloud/admin/sigs";
import { decide, listJoinRequests } from "@controller/cloud/admin/joinRequests";
import { listAuditEntries } from "@controller/cloud/admin/audit";
import { listReports, resolveReport } from "@controller/cloud/admin/reports";
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

admin.get("/posts", contentModeratorOnly, listPosts);
admin.post("/posts/batch", contentModeratorOnly, batchPosts);
admin.post("/posts/:id/pin", contentModeratorOnly, pinPost);
admin.post("/posts/:id/remove", contentModeratorOnly, removePost);
admin.post("/posts/:id/restore", contentModeratorOnly, restorePost);

admin.get("/users", contentModeratorOnly, listUsers);
admin.get("/users/:id", contentModeratorOnly, readUser);
admin.post("/users/:id/permission", adminOnly, setPermission);
admin.post("/users/:id/badges", adminOnly, setBadges);

admin.get("/comments", contentModeratorOnly, listComments);
admin.post("/comments/:id/remove", contentModeratorOnly, removeComment);
admin.post("/comments/:id/restore", contentModeratorOnly, restoreComment);

// Admin, or SIG manager (scoped)
admin.get("/sigs", listSigs);
admin.get("/join-requests", listJoinRequests);
admin.post("/join-requests/:id/decision", decide);

admin.get("/audit", adminOnly, listAuditEntries);

admin.get("/reports", contentModeratorOnly, listReports);
admin.post("/reports/:id/resolve", contentModeratorOnly, resolveReport);
admin.post("/digest/preview", adminOnly, previewDigest);

export default admin;
