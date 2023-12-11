import { Request, RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import JoinRequest from "@module/JoinRequest";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB.User();
const JoinRequestDB = new MongoDB.JoinRequest();

export const join: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const { body } = req;
        const sigId = (req as Request).params.sigId;
        const decodedJwt: any = (req as ExtendedRequest).JWT;
        const userId = decodedJwt.id;

        if (!sigId || !isValidObjectId(sigId))
            throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        new CheckRequestRequirement(req as Request).matchBody(["q1", "q2", "q3"]);

        const { q1, q2, q3 } = body;

        if (q1.length > 250 || q2.length > 250 || q3.length > 250) {
            throw new CustomError(CustomStatus.INVALID_CONTENT_LENGTH, new Error("Invalid content length"));
        }

        if (q1.trim() === "" || q2.trim() === "" || q3.trim() === "") {
            throw new CustomError(CustomStatus.INVALID_BODY, new Error("q1, q2 or q3 is empty"));
        }

        const userData = await UserDB.read({ id: userId });
        if (userData.sig?.includes(sigId)) {
            throw new CustomError(CustomStatus.ALREADY_JOINED, new Error("Already joined"));
        }

        const oldJoinRequest = await JoinRequestDB.read({
            user: userId,
            sig: sigId,
        }).catch(() => null);
        if (oldJoinRequest) {
            throw new CustomError(CustomStatus.ALREADY_APPLIED, new Error("Already applied"));
        }

        const requestData = await JoinRequestDB.write({
            user: userId,
            sig: sigId,
            q1,
            q2,
            q3,
            state: "pending",
        });

        await JoinRequest(sigId, userId, requestData);

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            data: requestData,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const readJoinRequest: RequestHandler = async (req: Request | ExtendedRequest, res) => {
    try {
        const sigId = (req as Request).params.sigId;
        const decodedJwt: any = (req as ExtendedRequest).JWT;
        const userId = decodedJwt.id;

        const userData = await UserDB.read({ id: userId });
        if (!userData.sig?.includes(sigId)) {
            throw new CustomError(CustomStatus.NOT_A_MEMBER, new Error("Not a member"));
        }

        const oldJoinRequest = await JoinRequestDB.read({
            user: userId,
            sig: sigId,
        }).catch(() => null);
        if (!oldJoinRequest) {
            throw new CustomError(CustomStatus.NOT_A_MEMBER, new Error("Not a member"));
        }

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            state: oldJoinRequest.state,
            data: oldJoinRequest,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
