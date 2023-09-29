import { Router } from "express";
import { upload } from "./upload";
import bodyParser from "body-parser";


const image: Router = Router();

image.use("/upload", bodyParser.raw({ limit: "2mb" }));
image.post("/upload", upload);

export default image;