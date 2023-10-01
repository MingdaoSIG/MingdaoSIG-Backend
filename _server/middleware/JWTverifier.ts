import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

import { RequestContainJWT } from "@type/request";
import CustomError from "@type/customError";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB("profile");

export default async function JWTverifier(req: Request, res: Response, next: NextFunction) {
    const SECRET_KEY: Secret = process.env.JWT_SECRET!;

    try {
        const authHeader = req.header("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.sendStatus(HttpStatus.UNAUTHORIZED);
        }

        const token = authHeader.replace("Bearer ", "");
        let decoded: any;
        try {
            decoded = jwt.verify(token, SECRET_KEY);
        }
        catch (error) {
            throw new CustomError(CustomStatus.INVALID_JWT, error);
        }

        checkData(decoded, ["id", "iat"]);

        try {
            if (!isValidObjectId(decoded.id)) throw new Error("Invalid user id");
            await UserDB.read({ id: decoded.id });
        }
        catch (error: any) {
            throw new CustomError(CustomStatus.INVALID_JWT, error);
        }

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
