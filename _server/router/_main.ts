import { Request, Response, Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { HttpStatus } from "@HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import image from "./image";
import login from "./login";
import post from "./post";
import sig from "./sig";
import user from "./user";
import comment from "./comment";
import ping from "./ping";


const router: Router = Router();

router.use("/login", login);
router.use("/sig", sig);
router.use("/user", user);
router.use("/post", post);
router.use("/comment", comment);
router.use("/image", image);
router.use("/ping", ping);

router.use("/needauth", JWTverifier);
router.get("/needauth", (_: Request, res: Response) => {
    res.status(HttpStatus.OK).send("You got it here!");
});

router.use("/*", (_: Request, res: Response) => {
    res.status(HttpStatus.NOT_FOUND).json({ status: CustomStatus.NOT_FOUND });
});

export default router;
