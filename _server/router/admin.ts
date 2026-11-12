import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import adminOnly from "@middleware/adminOnly";
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
import { createSig } from "@controller/cloud/admin/sigCreate";
import {
  applyRolloverHandler,
  batchLeaders,
  mergeSig,
  movePostsHandler,
  previewRollover,
} from "@controller/cloud/admin/sigOps";
import { decide, listJoinRequests } from "@controller/cloud/admin/joinRequests";
import { listAuditEntries } from "@controller/cloud/admin/audit";
import { previewDigest } from "@controller/cloud/admin/digest";

// Admin panel API (contract v3 §3). Every route needs a JWT; GETs use the
// read tier and everything else the write tier. Routes without adminOnly
// are also open to SIG managers and scope the result themselves.
const admin: Router = Router();

admin.use(rateLimiter(RateLimiterOption.BY_METHOD));
admin.use(JWTverifier);

admin.get("/overview", adminOnly, overview);

admin.get("/posts", adminOnly, listPosts);
admin.post("/posts/batch", adminOnly, batchPosts);
admin.post("/posts/move", adminOnly, movePostsHandler);
admin.post("/posts/:id/pin", adminOnly, pinPost);
admin.post("/posts/:id/remove", adminOnly, removePost);
admin.post("/posts/:id/restore", adminOnly, restorePost);

admin.get("/users", adminOnly, listUsers);
admin.get("/users/:id", adminOnly, readUser);
admin.post("/users/:id/permission", adminOnly, setPermission);
admin.post("/users/:id/badges", adminOnly, setBadges);

admin.get("/comments", adminOnly, listComments);
admin.post("/comments/:id/remove", adminOnly, removeComment);
admin.post("/comments/:id/restore", adminOnly, restoreComment);

admin.post("/sigs", adminOnly, createSig);
admin.post("/sigs/leaders/batch", adminOnly, batchLeaders);
admin.post("/sigs/:id/merge", adminOnly, mergeSig);

admin.get("/rollover/preview", adminOnly, previewRollover);
admin.post("/rollover/apply", adminOnly, applyRolloverHandler);

// Admin, or SIG manager (scoped)
admin.get("/sigs", listSigs);
admin.get("/join-requests", listJoinRequests);
admin.post("/join-requests/:id/decision", decide);

admin.get("/audit", adminOnly, listAuditEntries);

admin.post("/digest/preview", adminOnly, previewDigest);

export default admin;
