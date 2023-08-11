import express, { Request, Response, Router } from "express";
import { rateLimit } from "express-rate-limit";

import { status } from "../../_modules/HttpStatusCode";


const router: Router = express.Router();

const limiter_1m_10req = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: "Too many requests, please try again later."
});

const limiter_1m_20req = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: "Too many requests, please try again later."
});

router.use("/users/login", limiter_1m_10req);
router.get("/users/login", (req: Request, res: Response) => {
    res.status(status.OK).json("Hello World");
});

router.get("/*", (_: Request, res: Response) => {
    res.status(status.FORBIDDEN).send("Please insert correct path");
});

export default router;