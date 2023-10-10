import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { write as write } from "@controller/cloud/post/write";
import { read as read } from "@controller/cloud/post/read";
import { remove as remove } from "@controller/cloud/post/remove";
import { listAllByUser as listAllByUser, listAll as postListAll, listAllBySig as listAllBySig } from "@controller/cloud/post/list";
import { dislike, like } from "@controller/cloud/post/like";



const post: Router = Router();

post.get("/list", postListAll);
post.get("/list/user/:id", listAllByUser);
post.get("/list/sig/:id", listAllBySig);
post.get("/:id", read);

post.use("/", JWTverifier);
post.post("/", write);
post.post("/:id", write);
post.delete("/:id", remove);
post.post("/:id/like", like);
post.delete("/:id/like", dislike);

export default post;