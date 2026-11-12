import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { create, listMine } from "@controller/cloud/issueReport";

// Issue reports (問題回報): signed-in users only. Handling them is under
// /admin/issue-reports.
const issueReport: Router = Router();

issueReport.use(rateLimiter(RateLimiterOption.BY_METHOD));
issueReport.use(JWTverifier);
issueReport.post("/", create);
issueReport.get("/mine", listMine);

export default issueReport;
