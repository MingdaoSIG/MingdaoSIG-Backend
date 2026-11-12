import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import {
  publicKey,
  requirePush,
  subscribe,
  unsubscribe,
} from "@controller/cloud/push";

// Web push (contract v4 §2.3). Every route answers 503/5000 while push is
// not configured.
const push: Router = Router();

push.use(rateLimiter(RateLimiterOption.BY_METHOD));
push.use(requirePush);

push.get("/public-key", publicKey);
push.post("/subscribe", JWTverifier, subscribe);
push.delete("/subscribe", JWTverifier, unsubscribe);

export default push;
