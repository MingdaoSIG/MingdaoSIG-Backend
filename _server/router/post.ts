import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { write } from "@controller/cloud/post/write";
import { read } from "@controller/cloud/post/read";
import { remove } from "@controller/cloud/post/remove";
import {
  listAllByUser,
  listAll,
  listAllBySig,
  listAllByUserLike,
  listAllByPinned
} from "@controller/cloud/post/list";
import { dislike, like } from "@controller/cloud/post/like";


const post: Router = Router();

post.get("/list", listAll);

post.get("/list/user/:id", listAllByUser);
post.get("/list/user/:id/like", listAllByUserLike);
post.get("/list/sig/:id", listAllBySig);
post.get("/list/pinned", listAllByPinned);

post.get("/:id", read);

post.use("/", JWTverifier);

post.use("/:id/like", rateLimiter(RateLimiterOption._1m_200req));
post.post("/:id/like", like);
post.delete("/:id/like", dislike);

post.use("/", rateLimiter(RateLimiterOption._1m_100req));
post.post("/", write);

post.post("/:id", write);
post.delete("/:id", remove);

export default post;
