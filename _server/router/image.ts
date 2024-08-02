import { Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { upload } from "@controller/cloud/image/upload";
import { read } from "@controller/cloud/image/read";


const image: Router = Router();

image.use("/:id", rateLimiter(RateLimiterOption._1m_600req));
image.get("/:id", read);

image.use("/", rateLimiter(RateLimiterOption._1m_50req));
image.use("/", JWTverifier);
image.use(
  "/",
  bodyParser.raw({
    type: "*/*",
    limit: "1gb"
  })
);
image.post("/", upload);

export default image;
