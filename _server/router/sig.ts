import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import rateLimiter from "@middleware/rateLimiter";
import { readById, readByCustomId } from "@controller/cloud/sig/read";
import { write } from "@controller/cloud/sig/write";
import { listAll } from "@controller/cloud/sig/list";
import { join, readJoinRequest } from "@controller/cloud/sig/join";
import { confirmJoinRequest } from "@controller/cloud/sig/confirm";


const sig: Router = Router();

sig.get("/list", listAll);

sig.use("/@:customId", rateLimiter("1m_20req"));
sig.get("/@:customId", readByCustomId);

sig.use("/:sigId", rateLimiter("1m_20req"));
sig.get("/:sigId", readById);

sig.get("/confirm/:confirmId", confirmJoinRequest);

sig.use(JWTverifier);
sig.post("/:id", write);
sig.get("/:sigId/join", readJoinRequest);
sig.post("/:sigId/join", join);

export default sig;
