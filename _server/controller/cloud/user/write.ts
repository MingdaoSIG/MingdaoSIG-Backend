import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { User } from "@type/user";
import { RequestContainJWT } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import CheckValidCustomId from "@module/CheckValidCustomId";


const UserDB = new MongoDB("user");

export const write: RequestHandler = async (req: Request | RequestContainJWT, res) => {
    try {
        const { body } = req;
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as RequestContainJWT).JWT;

        if (!id || id !== decodedJwt.id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_USER, new Error("Invalid user"));

        const userData: User | null = await UserDB.read({ id }).catch(() => null);
        if (!userData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("User not found"));

        new CheckRequestRequirement(req as Request).forbiddenBody(["_id", "email", "name", "code", "class", "identity", "avatar", "permission", "removed", "createAt", "updateAt", "__v"]);

        await CheckValidCustomId(body.customId);

        if (body.description && body.description?.length > 250) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid description"));

        const savedData: User = await UserDB.write(body, { id });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: savedData._id,
            data: savedData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
