import { Router } from "express";

import rateLimiter from "@middleware/rateLimiter";
import { login as _login } from "@controller/cloud/login";


const login: Router = Router();

login.use("/login", rateLimiter("1m_10req"));
login.post("/", _login);

export default login;