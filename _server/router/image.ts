import { Router } from "express";
import bodyParser from "body-parser";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  checkUploadHeaders,
  upload
} from "@controller/cloud/image/upload";
import { read } from "@controller/cloud/image/read";


const image: Router = Router();

image.use("/:id", rateLimiter(RateLimiterOption._1m_1200req));
image.get("/:id", read);

image.use("/", rateLimiter(RateLimiterOption.UPLOAD));
image.use("/", JWTverifier);
image.post(
  "/",
  checkUploadHeaders,
  bodyParser.raw({
    type: ALLOWED_IMAGE_TYPES,
    limit: MAX_UPLOAD_BYTES
  }),
  upload
);

export default image;
