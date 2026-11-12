import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { searchAll, searchUserList } from "@controller/cloud/search";

// Unified search (API contract v4 §6.3), public.
const search: Router = Router();

search.use(rateLimiter(RateLimiterOption.BY_METHOD));
search.get("/", searchAll);
search.get("/users", searchUserList);

export default search;
