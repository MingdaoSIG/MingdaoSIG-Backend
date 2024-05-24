import { Router } from "express";

import rateLimiter from "@middleware/rateLimiter";
import {
  postUsers,
  users,
  usersOfEachSigs
} from "@controller/cloud/information/user";
import { posts, postsOfEachSigs } from "@controller/cloud/information/post";
import { likes } from "@controller/cloud/information/likes";


const information: Router = Router();

information.use("/", rateLimiter("1m_20req"));

information.get("/user", users);
information.get("/user/posted", postUsers);
information.get("/user/sig", usersOfEachSigs);

information.get("/post", posts);
information.get("/post/sig", postsOfEachSigs);

information.get("/like", likes);

export default information;
