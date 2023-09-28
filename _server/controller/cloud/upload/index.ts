import { Router, json } from "express";
import { image } from "./image";
import bodyParser from "body-parser";


const upload: Router = Router();

upload.use("/image", bodyParser.raw({ limit: "2mb" }));
upload.post("/image", image);

export default upload;