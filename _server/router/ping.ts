import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { ping as _ping } from "@controller/cloud/ping";


const ping: Router = Router();

ping.use("/login", rateLimiter(RateLimiterOption._1m_50req));
ping.get("/", _ping);

export default ping;
