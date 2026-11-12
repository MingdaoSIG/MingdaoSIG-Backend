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
import { search } from "@controller/cloud/post/search";
import {
  listAllByHashtag,
  listTopHashtags,
} from "@controller/cloud/post/hashtag";
import { sitemap } from "@controller/cloud/post/sitemap";
import { bookmark, unbookmark } from "@controller/cloud/post/bookmark";

const post: Router = Router();

// GET requests use the read tier.
post.use(rateLimiter(RateLimiterOption.BY_METHOD));
post.get("/list", listAll);

post.get("/list/user/:id", listAllByUser);
post.get("/list/user/:id/like", listAllByUserLike);
post.get("/list/sig/:id", listAllBySig);
post.get("/list/pinned", listAllByPinned);
post.get("/list/hashtag/:tag", listAllByHashtag);
post.get("/hashtags/top", listTopHashtags);
post.get("/search", search);
post.get("/sitemap", sitemap);
// Admin pages only: JWT required, then permission 2.
post.get("/list/admin", JWTverifier, adminOnly, listForAdmin);
post.get("/list/range", JWTverifier, adminOnly, listAllByTimeRange);

post.get("/:id", read);

post.use("/", JWTverifier);

post.post("/:id/like", like);
post.delete("/:id/like", dislike);
post.post("/:id/bookmark", bookmark);
post.delete("/:id/bookmark", unbookmark);

post.post("/", write);

post.post("/:id", write);
post.delete("/:id", remove);

export default post;
