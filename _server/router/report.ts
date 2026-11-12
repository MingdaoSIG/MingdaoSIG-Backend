import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { create } from "@controller/cloud/report/create";

// Reports (contract v4 §4.6). Handling them is under /admin/reports.
const report: Router = Router();

report.use(rateLimiter(RateLimiterOption.WRITE));
report.use(JWTverifier);
report.post("/", create);

export default report;
