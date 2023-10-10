import { Router } from "express";

// import rateLimiter from "@middleware/rateLimiter";
import { login as _login } from "@controller/cloud/login";


const login: Router = Router();

// router.use("/login", rateLimiter.limiter_1m_10req);
login.post("/", _login);

export default login;