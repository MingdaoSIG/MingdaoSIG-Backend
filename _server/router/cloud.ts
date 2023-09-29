import { Request, Response, Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";
import { login } from "@controller/cloud/login";
import image from "@controller/cloud/image";
import { HttpStatus } from "@HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
// import bodyParser from "body-parser";


const router: Router = Router();

// router.use("/login", rateLimiter.limiter_1m_10req);
router.post("/login", login);

router.use("/image", rateLimiter.limiter_1m_20req);
router.use("/image", JWTverifier);
router.use("/image", image);

router.use("/needauth", JWTverifier);
router.get("/needauth", (_: Request, res: Response) => {
    res.status(HttpStatus.OK).send("You got it here!");
});

router.get("/*", (_: Request, res: Response) => {
    res.status(HttpStatus.NOT_FOUND).json({ statuscode: CustomStatus.NOT_FOUND });
});

export default router;