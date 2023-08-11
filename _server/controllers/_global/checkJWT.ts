import { Request, Response, NextFunction } from "express";
import jwt, { Secret, JwtPayload } from "jsonwebtoken";

import { status } from "../../../_modules/HttpStatusCode";


export const SECRET_KEY: Secret = String(process.env.JWT_SECRET);

export interface CustomRequest extends Request {
    JWT: string | JwtPayload;
}

export default async function JWTverifier(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.sendStatus(status.UNAUTHORIZED);
        }

        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.verify(token, SECRET_KEY);

        const customReq = req as CustomRequest;
        customReq.JWT = decoded;

        next();
    }
    catch (error: any) {
        console.log(error);
        return res.sendStatus(status.UNAUTHORIZED);
    }
}