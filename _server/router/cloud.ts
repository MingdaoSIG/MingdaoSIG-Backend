import { Request, Response, Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { login } from "@controller/cloud/login";
import { upload as imageUpload } from "@controller/cloud/image/upload";
import { read as imageRead } from "@controller/cloud/image/read";
import { HttpStatus } from "@HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import { readByCustomId as userReadByCustomId, readById as userReadById } from "@controller/cloud/profile/user/read";
import { write as userWrite } from "@controller/cloud/profile/user/write";
import { write } from "@controller/cloud/post/write";


const router: Router = Router();

// router.use("/login", rateLimiter.limiter_1m_10req);
router.post("/login", login);

// router.use("/image", rateLimiter.limiter_1m_20req);
router.get("/image/:id", imageRead);
router.use("/image", JWTverifier);
router.use("/image", bodyParser.raw({ limit: "2mb" }));
router.post("/image", imageUpload);

router.get("/profile/user/@:id", userReadByCustomId);
router.get("/profile/user/:id", userReadById);
router.use("/profile", JWTverifier);
router.post("/profile/user/:id", userWrite);

router.use("/post", JWTverifier);
router.post("/post", write);

router.use("/needauth", JWTverifier);
// router.use("/image", rateLimiter.limiter_1m_20req);
router.get("/needauth", (_: Request, res: Response) => {
    res.status(HttpStatus.OK).send("You got it here!");
});

router.use("/*", (_: Request, res: Response) => {
    res.status(HttpStatus.NOT_FOUND).json({ statuscode: CustomStatus.NOT_FOUND });
});

export default router;