import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import adminOnly from "@middleware/adminOnly";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { write } from "@controller/cloud/post/write";
import { read } from "@controller/cloud/post/read";
import { remove } from "@controller/cloud/post/remove";
import {
  listAllByUser,
  listAll,
  listAllBySig,
  listAllByUserLike,
  listAllByPinned,
  listAllByTimeRange,
  listForAdmin,
} from "@controller/cloud/post/list";
import { dislike, like } from "@controller/cloud/post/like";

const post: Router = Router();

// GET requests use the read tier.
post.use(rateLimiter(RateLimiterOption.BY_METHOD));
post.get("/list", listAll);

post.get("/list/user/:id", listAllByUser);
post.get("/list/user/:id/like", listAllByUserLike);
post.get("/list/sig/:id", listAllBySig);
post.get("/list/pinned", listAllByPinned);
// Admin pages only: JWT required, then permission 2.
post.get("/list/admin", JWTverifier, adminOnly, listForAdmin);
post.get("/list/range", JWTverifier, adminOnly, listAllByTimeRange);

post.get("/:id", read);

post.use("/", JWTverifier);

post.post("/:id/like", like);
post.delete("/:id/like", dislike);

post.post("/", write);

post.post("/:id", write);
post.delete("/:id", remove);

export default post;
