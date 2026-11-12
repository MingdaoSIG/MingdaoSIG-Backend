import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { list, read, unreadCount } from "@controller/cloud/notification";

// The caller's own notifications (contract v4 §2.1). GETs use the read tier
// (the frontend polls unread-count every 60 s), POSTs the write tier.
const notification: Router = Router();

notification.use(rateLimiter(RateLimiterOption.BY_METHOD));
notification.use(JWTverifier);

notification.get("/list", list);
notification.get("/unread-count", unreadCount);
notification.post("/read", read);

export default notification;
