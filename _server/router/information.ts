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

information.use("/user", rateLimiter("1m_20req"));
information.get("/user", users);
information.use("/user/posted", rateLimiter("1m_20req"));
information.get("/user/posted", postUsers);
information.use("/user/sig", rateLimiter("1m_20req"));
information.get("/user/sig", usersOfEachSigs);

information.use("/post", rateLimiter("1m_20req"));
information.get("/post", posts);
information.use("/post/sig", rateLimiter("1m_20req"));
information.get("/post/sig", postsOfEachSigs);

information.use("/like", rateLimiter("1m_20req"));
information.get("/like", likes);

export default information;
