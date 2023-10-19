import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { write as write } from "@controller/cloud/post/write";
import { read as read } from "@controller/cloud/post/read";
import { remove as remove } from "@controller/cloud/post/remove";
import { listAllByUser, listAll, listAllBySig, listAllByUserLike } from "@controller/cloud/post/list";
import { dislike, like } from "@controller/cloud/post/like";



const comment: Router = Router();

comment.get("/", listAll);
comment.get("/list/post/:postId", listAllByUser);
comment.get("/list/reply/:replyId", listAllByUserLike);

comment.use("/", JWTverifier);
comment.post("/", write);
comment.post("/:commentId", write);

export default comment;