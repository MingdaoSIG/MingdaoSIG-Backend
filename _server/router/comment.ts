import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { write } from "@controller/cloud/comment/write";
import { listAllByPost } from "@controller/cloud/comment/list";


const comment: Router = Router();

comment.use("/:id", rateLimiter(RateLimiterOption._1m_200req));
comment.get("/list/post/:postId", listAllByPost);
// TODO: list all reply by comment

comment.use("/", rateLimiter(RateLimiterOption._1m_100req));
comment.use("/", JWTverifier);
comment.post("/", write);
// TODO: write comment (update)

export default comment;
