import { Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";
import { upload } from "@controller/cloud/image/upload";
import { read } from "@controller/cloud/image/read";


const image: Router = Router();

image.use("/:id", rateLimiter("1m_600req"));
image.get("/:id", read);

image.use("/", rateLimiter("1m_10req"));
image.use("/", JWTverifier);
image.use("/", bodyParser.raw({
    type: "*/*",
    limit: "1gb"
}));
image.post("/", upload);

export default image;