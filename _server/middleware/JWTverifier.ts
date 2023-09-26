import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";

import { RequestContainJWT } from "@type/request";
import { HttpStatus } from "@module/HttpStatusCode";


const SECRET_KEY: Secret = String(process.env.JWT_SECRET);

export default async function JWTverifier(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.sendStatus(HttpStatus.UNAUTHORIZED);
        }

        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.verify(token, SECRET_KEY);

        const customReq = req as unknown as RequestContainJWT;
        customReq.JWT = decoded;

        next();
    }
    catch (error: any) {
        return res.sendStatus(HttpStatus.UNAUTHORIZED);
    }
}