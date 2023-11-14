import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { write } from "@controller/cloud/comment/write";
import { listAllByPost } from "@controller/cloud/comment/list";
import rateLimiter from "@middleware/rateLimiter";


const comment: Router = Router();

comment.use("/:id", rateLimiter("1m_20req"));
comment.get("/list/post/:postId", listAllByPost);
// TODO: list all reply by comment

comment.use("/", rateLimiter("1m_10req"));
comment.use("/", JWTverifier);
comment.post("/", write);
// TODO: write comment (update)

export default comment;