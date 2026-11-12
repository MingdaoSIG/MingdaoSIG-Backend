import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { listBadges } from "@controller/cloud/admin/badges";

const badge: Router = Router();

badge.use(rateLimiter(RateLimiterOption.BY_METHOD));
// Public: the badges that are not retired (contract v4 §5.9).
badge.get("/list", listBadges);

export default badge;
