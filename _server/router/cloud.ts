import express, { Request, Response, Router } from "express";

// Middlewares
import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";

// Controllers
import { login } from "@controller/cloud/users/login";

// Modules
import { HTTPstatus } from "@module/HttpStatusCode";

const router: Router = express.Router();

router.use("/login", rateLimiter.limiter_1m_10req);
router.get("/login", login);

router.use("/needauth", JWTverifier);
router.get("/needauth", (req: Request, res: Response) => {
    res.status(HTTPstatus.OK).send("You got it here!");
});

router.get("/*", (_: Request, res: Response) => {
    res.status(HTTPstatus.FORBIDDEN).send("Please insert correct path");
});

export default router;