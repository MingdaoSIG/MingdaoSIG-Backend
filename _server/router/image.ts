import { Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
// import rateLimiter from "@middleware/rateLimiter";
import { upload } from "@controller/cloud/image/upload";
import { read } from "@controller/cloud/image/read";


const image: Router = Router();

// router.use(rateLimiter.limiter_1m_20req);
image.get("/:id", read);

image.use("/", JWTverifier);
image.use("/", bodyParser.raw({
    type: "*/*",
    limit: "1gb"
}));
image.post("/", upload);

export default image;