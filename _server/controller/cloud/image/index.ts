import bodyParser from "body-parser";

import { Router } from "express";
import { upload } from "./upload";
import { read } from "./read";


const image: Router = Router();

image.get("/:id", read);

image.use("/upload", bodyParser.raw({ limit: "2mb" }));
image.post("/upload", upload);

export default image;