import { Router } from "express";

import rateLimiter from "@middleware/rateLimiter";
import { ping as _ping } from "@controller/cloud/ping";


const ping: Router = Router();

ping.use("/login", rateLimiter("1m_10req"));
ping.get("/", _ping);

export default ping;