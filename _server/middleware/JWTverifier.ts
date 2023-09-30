import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

import { RequestContainJWT } from "@type/request";
import CustomError from "@type/customError";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function JWTverifier(req: Request, res: Response, next: NextFunction) {
    const SECRET_KEY: Secret = process.env.JWT_SECRET!;

    try {
        const authHeader = req.header("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.sendStatus(HttpStatus.UNAUTHORIZED);
        }

        const token = authHeader.replace("Bearer ", "");
        const decoded: any = jwt.verify(token, SECRET_KEY);

        checkData(decoded, ["_id", "iat"]);

        if (!isValidObjectId(decoded._id)) throw new CustomError(CustomStatus.INVALID_JWT, new Error("Invalid user id"));

        const customReq = req as unknown as RequestContainJWT;
        customReq.JWT = decoded;

        next();
    }
    catch (error: any) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
}

function checkData(data: any, keys: string[]) {
    try {
        // Check if input is an object
        if (typeof data != "object") throw new Error("Not a object");

        // Check if object have all required keys
        if (Object.keys(data).length != keys.length) throw new Error("Invalid data");
        for (const key of keys) {
            if (!(key in data)) throw new Error("Invalid data");
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.INVALID_JWT, error);
    }

    return true;
}
