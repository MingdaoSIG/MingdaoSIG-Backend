import { Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { upload } from "@controller/cloud/image/upload";
import { read } from "@controller/cloud/image/read";


const image: Router = Router();

// router.use(rateLimiter.limiter_1m_20req);
image.use(bodyParser.raw({ type: "image/webp" }));

image.get("/:id", read);

image.use("/", JWTverifier);
image.use("/", bodyParser.raw({ limit: "2mb" }));
image.post("/", upload);

export default image;