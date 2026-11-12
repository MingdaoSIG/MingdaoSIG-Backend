import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import {
  readByCustomId,
  readById,
  readFullById,
  readMe,
} from "@controller/cloud/user/read";
import { write } from "@controller/cloud/user/write";
import { stats } from "@controller/cloud/user/stats";
import {
  listBookmarkIds,
  listBookmarks,
} from "@controller/cloud/post/bookmark";
import { listByUser as listSeriesByUser } from "@controller/cloud/series";

const user: Router = Router();

user.use(rateLimiter(RateLimiterOption.BY_METHOD));
user.get("/me", JWTverifier, readMe);
user.get("/me/stats", JWTverifier, stats);
user.get("/me/bookmarks", JWTverifier, listBookmarks);
user.get("/me/bookmarks/ids", JWTverifier, listBookmarkIds);
user.get("/@:id", readByCustomId);
user.get("/:id/full", JWTverifier, readFullById);
user.get("/:id/series", listSeriesByUser);
user.get("/:id", readById);

user.use(JWTverifier);
user.post("/", write);

export default user;
