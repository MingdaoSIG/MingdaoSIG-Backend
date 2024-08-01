import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import {
  postUsers,
  users,
  usersOfEachSigs
} from "@controller/cloud/information/user";
import { posts, postsOfEachSigs } from "@controller/cloud/information/post";
import { likes } from "@controller/cloud/information/likes";


const information: Router = Router();

information.use("/user", rateLimiter(RateLimiterOption._1m_100req));
information.get("/user", users);
information.use("/user/posted", rateLimiter(RateLimiterOption._1m_100req));
information.get("/user/posted", postUsers);
information.use("/user/sig", rateLimiter(RateLimiterOption._1m_100req));
information.get("/user/sig", usersOfEachSigs);

information.use("/post", rateLimiter(RateLimiterOption._1m_100req));
information.get("/post", posts);
information.use("/post/sig", rateLimiter(RateLimiterOption._1m_100req));
information.get("/post/sig", postsOfEachSigs);

information.use("/like", rateLimiter(RateLimiterOption._1m_100req));
information.get("/like", likes);

export default information;
