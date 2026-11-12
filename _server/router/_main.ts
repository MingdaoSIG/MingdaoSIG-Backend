import { Request, Response, Router } from "express";

import { HttpStatus } from "@HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import image from "./image";
import login from "./login";
import post from "./post";
import sig from "./sig";
import user from "./user";
import comment from "./comment";
import ping from "./ping";
import information from "./information";
import admin from "./admin";
import event from "./event";
import feedback from "./feedback";

const router: Router = Router();

router.use("/login", login);
router.use("/sig", sig);
router.use("/user", user);
router.use("/post", post);
router.use("/comment", comment);
router.use("/image", image);
router.use("/ping", ping);
router.use("/information", information);
router.use("/admin", admin);
router.use("/event", event);
router.use("/feedback", feedback);

router.use((_: Request, res: Response) => {
  res.status(HttpStatus.NOT_FOUND).json({ status: CustomStatus.NOT_FOUND });
});

export default router;
