import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";
import { readById, readByCustomId } from "@controller/cloud/sig/read";
import { write } from "@controller/cloud/sig/write";
import { listAll } from "@controller/cloud/sig/list";

const sig: Router = Router();

sig.get("/list", listAll);

sig.use("/@:id", rateLimiter("1m_20req"));
sig.get("/@:id", readByCustomId);

sig.use("/:id", rateLimiter("1m_20req"));
sig.get("/:id", readById);

sig.use(JWTverifier);
sig.post("/:id", write);

export default sig;