import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { write } from "@controller/cloud/comment/write";


const comment: Router = Router();

// comment.get("/", listAll);
// comment.get("/list/post/:postId", listAllByUser);
// comment.get("/list/reply/:replyId", listAllByUserLike);

comment.use("/", JWTverifier);
comment.post("/", write);
// comment.post("/:commentId", write);

export default comment;