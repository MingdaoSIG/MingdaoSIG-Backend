import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Profile } from "@type/profile";
import { RequestContainJWT } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB("profile");

export const write: RequestHandler = async (req: Request | RequestContainJWT, res) => {
    try {
        const { body } = req;
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as RequestContainJWT).JWT;

        if (!id || id !== decodedJwt.id || !isValidObjectId(id)) {
            throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));
        }

        const forbiddenKeys = ["_id", "email", "name", "code", "class", "identity", "avatar", "permission", "createAt", "updateAt", "__v"];
        const invalidKeys = Object.keys(body).filter(key => forbiddenKeys.includes(key));
        if (invalidKeys.length > 0 || Object.keys(body).length === 0) {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid body"));
        }

        const savedData: Profile = await UserDB.write(body, { id });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id,
            decodedJwt,
            data: savedData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
