import { Router } from "express";

import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { login as _login } from "@controller/cloud/login";

const login: Router = Router();

login.use(rateLimiter(RateLimiterOption.LOGIN));
login.post("/", _login);

export default login;
