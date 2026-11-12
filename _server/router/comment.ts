import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { write } from "@controller/cloud/comment/write";
import { edit } from "@controller/cloud/comment/edit";
import { remove } from "@controller/cloud/comment/remove";
import { listAllByPost } from "@controller/cloud/comment/list";

const comment: Router = Router();

comment.use(rateLimiter(RateLimiterOption.BY_METHOD));
comment.get("/list/post/:postId", listAllByPost);

comment.use("/", JWTverifier);
comment.post("/", write);
comment.post("/:id", edit);
comment.delete("/:id", remove);

export default comment;
