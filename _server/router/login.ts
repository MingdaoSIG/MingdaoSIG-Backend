import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { login as _login } from "@controller/cloud/login";


const login: Router = Router();

login.use("/login", rateLimiter(RateLimiterOption._1m_100req));
login.post("/", _login);

export default login;
