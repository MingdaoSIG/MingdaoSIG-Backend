import { Request, Response, NextFunction } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";


const config = {
    origin: [
        "http://localhost:3000"
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

export default function cors(req: Request, res: Response, next: NextFunction) {
    try {
        const { origin } = req.headers;
        const allowedOrigin = origin && config.origin.includes(origin);

        if (allowedOrigin) {
            res.header("Access-Control-Allow-Origin", origin);
            res.header("Access-Control-Allow-Headers", config.headers.join(", "));
        }

        next();
    }
    catch (error: any) {
        return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
}