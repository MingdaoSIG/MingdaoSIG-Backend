import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { editFeedback, removeFeedback } from "@controller/cloud/feedback";

// Teacher feedback by id (API contract v4 §3.2). Creating and listing it
// per post is in the post router.
const feedback: Router = Router();

feedback.use(rateLimiter(RateLimiterOption.BY_METHOD));
feedback.use(JWTverifier);
feedback.post("/:id", editFeedback);
feedback.delete("/:id", removeFeedback);

export default feedback;
