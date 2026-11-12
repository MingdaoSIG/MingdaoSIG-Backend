import express, { Express } from "express";
import bodyParser from "body-parser";

import router from "@router/_main";
import healthz from "@router/healthz";
import configuredCors from "@middleware/cors";
import errorHandler from "@middleware/errorHandler";
import requestLogger from "@middleware/requestLogger";


const cloud: Express = express();
cloud.use(requestLogger);
cloud.use(configuredCors);
// urlencoded is only used by POST /login (the frontend sends a form body).
cloud.use(bodyParser.urlencoded({ extended: false, limit: "100kb" }));
// Post content is capped at 100,000 characters; 1 MB leaves room for JSON
// escaping and multi-byte characters.
cloud.use(bodyParser.json({ limit: "1mb" }));
cloud.use("/", router);
cloud.use(errorHandler);

const server: Express = express();
server.set("trust proxy", 1);
// Mounted before the app: no auth, no rate limit, no access log noise.
server.use("/healthz", healthz);
server.use("/", cloud);

export default server;
