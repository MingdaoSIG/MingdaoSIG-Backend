import express, { Express } from "express";
import bodyParser from "body-parser";
import morgan from "morgan";

import router from "@router/_main";
import configuredCors from "@middleware/cors";
import errorHandler from "@middleware/errorHandler";


const cloud: Express = express();
cloud.use(morgan("combined"));
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
server.use("/", cloud);

export default server;
