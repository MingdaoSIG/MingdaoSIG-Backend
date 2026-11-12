import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { readByCustomId, readById } from "@controller/cloud/user/read";
import { write } from "@controller/cloud/user/write";


const user: Router = Router();

user.use(rateLimiter(RateLimiterOption.BY_METHOD));
user.get("/@:id", readByCustomId);
user.get("/:id", readById);

user.use(JWTverifier);
user.post("/", write);

export default user;
