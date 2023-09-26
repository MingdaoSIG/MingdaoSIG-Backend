import { Router } from "express";
import { image } from "./image";


const upload: Router = Router();

upload.use("/image", image);

export default upload;