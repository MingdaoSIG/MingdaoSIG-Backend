import express, { Request, Response, Router } from "express";

// Middlewares
import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";

// Controllers
import { login } from "@controller/cloud/users/login";

// Modules
import { HttpStatus } from "@HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";

const router: Router = express.Router();

router.use("/login", rateLimiter.limiter_1m_10req);
router.post("/login", login);

router.use("/needauth", JWTverifier);
router.get("/needauth", (req: Request, res: Response) => {
    res.status(HttpStatus.OK).send("You got it here!");
});

router.get("/*", (_: Request, res: Response) => {
    res.status(HttpStatus.NOT_FOUND).json({ statuscode: CustomStatus.NOT_FOUND });
});

export default router;