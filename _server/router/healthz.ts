import { Router } from "express";

import { healthz as _healthz } from "@controller/cloud/healthz";


const healthz: Router = Router();

healthz.get("/", _healthz);

export default healthz;
