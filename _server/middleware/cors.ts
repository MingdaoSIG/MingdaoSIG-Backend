import { Request, Response, NextFunction } from "express";
// import axios from "axios";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";


export default async function cors(req: Request, res: Response, next: NextFunction) {
    try {
        const { origin } = req.headers;
        const corsConfig = await getCorsConfig();
        const allowedOrigin = origin && corsConfig?.origin.includes(origin);

        if (allowedOrigin) {
            res.header({
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers": corsConfig?.headers.join(", ")
            });
        }

        next();
    }
    catch (error: any) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
}

// const cachedCors = {
//     config: null,
//     createAt: 0
// };
const defaultCorsConfig = {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://mdsig20-dev.lazco.dev",
        "https://sig.zeabur.app",
        "https://sig.mingdao.edu.tw"
    ],
    headers: [
        "Access-Control-Allow-Headers",
        "Origin",
        "Accept",
        "X-Requested-With",
        "Content-Type",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Authorization"
    ]
};
async function getCorsConfig() {
    return defaultCorsConfig;
    // const t0 = performance.now();

    // console.log(cachedCors);
    // if (cachedCors && Date.now() - cachedCors.createAt <= 5 * 60 * 1000) {
    //     const t1 = performance.now();
    //     // eslint-disable-next-line no-console
    //     console.log(`Server : successfully got cors config from cache (took ${Math.round(t1 - t0) / 1000} seconds)`);
    //     return cachedCors.config;
    // }

    // try {
    //     const response = await axios.get(
    //         "https://raw.githubusercontent.com/MingdaoSIG/Configurations/main/cors.json",
    //         {
    //             headers: {
    //                 "Authorization": "Token " + String(process.env.GITHUB_AUTH_TOKEN)
    //             }
    //         }
    //     );

    //     console.log(response.data);
    //     const t1 = performance.now();
    //     // eslint-disable-next-line no-console
    //     console.log(`Server : successfully got cors config from remote source (took ${Math.round(t1 - t0) / 1000} seconds)`);

    //     cachedCors.config = JSON.parse(response.data);
    //     cachedCors.createAt = Date.now();

    //     // return JSON.parse(response.data);
    // }
    // catch (error) {
    //     console.log(error);
    //     const t1 = performance.now();
    //     // eslint-disable-next-line no-console
    //     console.log(`Server : error getting cors config from remote source, use default config instead (took ${Math.round(t1 - t0) / 1000} seconds)`);
    //     return defaultCorsConfig;
    // }
}