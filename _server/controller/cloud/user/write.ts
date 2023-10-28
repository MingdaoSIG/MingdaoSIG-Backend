import { Request, RequestHandler } from "express";

import { User } from "@type/user";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import CheckValidCustomId from "@module/CheckValidCustomId";


const UserDB = new MongoDB("user");

export const write: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const decodedJwt: any = (req as ExtendedRequest).JWT;
        const userId = decodedJwt.id;
        const userData = (req as ExtendedRequest).userData;

        new CheckRequestRequirement(req as Request).forbiddenBody(["_id", "email", "name", "code", "class", "identity", "avatar", "permission", "removed", "createAt", "updateAt", "__v"]);

        if (userData.customId !== body.customId) await CheckValidCustomId(body.customId);

        if (body.description && body.description?.length > 250) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid description"));

        const dataToSave = {
            customId: String(body.customId),
            description: String(body.description),
        };
        const savedData: User = await UserDB.write(dataToSave, { id: userId });

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
