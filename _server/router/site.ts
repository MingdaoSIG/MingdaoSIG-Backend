import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { readBanner } from "@controller/cloud/site/banner";

// Public site-wide data (contract v4 §5.4).
const site: Router = Router();

site.use(rateLimiter(RateLimiterOption.READ));
site.get("/banner", readBanner);

export default site;
