/* eslint-disable no-console */
import express, { Express } from "express";
import bodyParser from "body-parser";
import morgan from "morgan";

import router from "@router/_main";
import cors from "@middleware/cors";
import { HttpStatus } from "@module/HttpStatusCode";


const cloud: Express = express();
cloud.use(morgan("combined"));
cloud.use(cors);
cloud.options("*", (_, res) => res.status(HttpStatus.OK).send("Success"));
cloud.use(bodyParser.urlencoded({ extended: true }));
cloud.use(bodyParser.json());
cloud.use("/", router);

const server: Express = express();
server.set("trust proxy", 1);
server.use("/", cloud);

export default server;