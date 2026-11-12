import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { create, edit, read, remove } from "@controller/cloud/series";

// Series (contract v4 §4.4). Reads are public; changes need a JWT.
const series: Router = Router();

series.use(rateLimiter(RateLimiterOption.BY_METHOD));
series.get("/:id", read);

series.use(JWTverifier);
series.post("/", create);
series.post("/:id", edit);
series.delete("/:id", remove);

export default series;
