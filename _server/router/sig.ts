import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import { readById, readByCustomId } from "@controller/cloud/sig/read";
import { write } from "@controller/cloud/sig/write";
import { listAll } from "@controller/cloud/sig/list";
import { join, readJoinRequest } from "@controller/cloud/sig/join";
import { confirmJoinRequest } from "@controller/cloud/sig/confirm";
import { addLeader } from "@controller/cloud/sig/addLeader";
import { addModerator } from "@controller/cloud/sig/addModerator";
import { deleteLeader } from "@controller/cloud/sig/deleteLeader";
import { deleteModerator } from "@controller/cloud/sig/deleteModerator";


const sig: Router = Router();

sig.get("/list", listAll);

sig.use("/@:customId", rateLimiter(RateLimiterOption._1m_200req));
sig.get("/@:customId", readByCustomId);

sig.use("/:sigId", rateLimiter(RateLimiterOption._1m_200req));
sig.get("/:sigId", readById);

sig.get("/confirm/:confirmId", confirmJoinRequest);

sig.use(JWTverifier);
sig.post("/:id", write);
sig.use("/:sigId/join", rateLimiter(RateLimiterOption._1m_1200req));
sig.get("/:sigId/join", readJoinRequest);
sig.post("/:sigId/join", join);
sig.post("/:sigId/leader", addLeader);
sig.post("/:sigId/moderator", addModerator);
sig.delete("/:sigId/leader", deleteLeader);
sig.delete("/:sigId/moderator", deleteModerator);

export default sig;
