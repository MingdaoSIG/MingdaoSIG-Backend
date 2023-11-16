import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import JoinSigRequest from "@module/JoinSigRequest";


export const join: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const sigId = (req as Request).params.sigId;
        const decodedJwt: any = (req as ExtendedRequest).JWT;
        const userId = decodedJwt.id;

        if (!sigId || !isValidObjectId(sigId)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        new CheckRequestRequirement(req as Request).matchBody(["q1", "q2", "q3"]);

        const { q1, q2, q3 } = body;

        if (q1.length > 250 || q2.length > 250 || q3.length > 250) throw new CustomError(CustomStatus.INVALID_CONTENT_LENGTH, new Error("Invalid content length"));
        if (q1.trim() === "" || q2.trim() === "" || q3.trim() === "") throw new CustomError(CustomStatus.INVALID_BODY, new Error("No q1, q2 or q3"));

        await JoinSigRequest(sigId, userId, { q1, q2, q3 });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            // TODO: requestId: string
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
