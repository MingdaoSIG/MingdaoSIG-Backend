import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { create, list, read, remove, update } from "@controller/cloud/draft";

// Cloud drafts (contract v4 §4.5): the caller's own, JWT only.
const draft: Router = Router();

draft.use(rateLimiter(RateLimiterOption.BY_METHOD));
draft.use(JWTverifier);
draft.get("/", list);
draft.get("/:id", read);
draft.post("/", create);
draft.post("/:id", update);
draft.delete("/:id", remove);

export default draft;
