import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Sig } from "@type/sig";
import { ExtendedRequest } from "@type/request";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import CheckValidCustomId from "@module/CheckValidCustomId";


const SigDB = new MongoDB("sig");

export const write: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const id = (req as Request).params.id;
        const decodedJwt: any = (req as ExtendedRequest).JWT;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const sigData: Sig | null = await SigDB.read({ id }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));

        if (!sigData.leader?.includes(decodedJwt.id) || !sigData.moderator?.includes(decodedJwt.id)) throw new CustomError(CustomStatus.FORBIDDEN, new Error("Forbidden"));

        new CheckRequestRequirement(req as Request).forbiddenBody(["_id", "name", "moderator", "leader", "removed"]);

        if (sigData.customId !== body.customId) await CheckValidCustomId(body.customId);

        if (body.description && body.description?.length > 250) throw new CustomError(CustomStatus.INVALID_DESCRIPTION_LENGTH, new Error("Invalid description"));

        const savedData: Sig = await SigDB.write(body, { id });

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
