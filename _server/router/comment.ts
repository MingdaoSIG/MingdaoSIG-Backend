import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { write } from "@controller/cloud/comment/write";
import { listAllByPost } from "@controller/cloud/comment/list";


const comment: Router = Router();

comment.get("/list/post/:postId", listAllByPost);
// TODO: list all reply by comment

comment.use("/", JWTverifier);
comment.post("/", write);
// TODO: write comment (update)

export default comment;