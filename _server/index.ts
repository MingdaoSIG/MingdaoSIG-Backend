import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import axios from "axios";

import router from "./routers/cloud";


const defaultCors = {
    "exposedHeaders": "Authorization",
    "origin": [
        "http://localhost:3000",
        "http://localhost:3001"
    ]
};

const cloud = express();
cloud.use(morgan("combined"));
(async () => {
    const config = await getCorsConfig();
    cloud.use(cors(config));
})();
cloud.use(bodyParser.urlencoded({ extended: true }));
cloud.use(bodyParser.json());
cloud.use("/", router);

const server = express();
server.set("trust proxy", 1);
server.use("/", cloud);

export default server;

async function getCorsConfig() {
    const t0 = performance.now();

    let cors = defaultCors;

    try {
        const response = await axios.get(
            "https://raw.githubusercontent.com/MingdaoSIG/Configurations/main/cors.json",
            {
                headers: {
                    "Authorization": "Token " + String(process.env.GITHUB_TOKEN_CONFIGURATION)
                }
            }
        );
        cors = response.data || defaultCors;

        const t1 = performance.now();
        console.log(`Server : successfully got cors config from remote source (took ${Math.round(t1 - t0) / 1000} seconds)`);
    }
    catch (err) {
        console.error("Server : cannot get cors config from remote source, using default cors config");
    }

    return cors;
}