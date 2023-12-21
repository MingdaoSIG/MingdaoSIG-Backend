import { RequestHandler } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB.User();
const JoinRequestDB = new MongoDB.JoinRequest();

export const confirmJoinRequest: RequestHandler = async (req, res) => {
    try {
        const confirmId = req.params.confirmId;
        const accept = req.query.accept;

        if (accept !== "true"&& accept !== "false") {
            throw new CustomError(
                CustomStatus.INVALID_QUERY,
                new Error("Invalid query")
            );
        }

        const oldJoinRequest = await JoinRequestDB.read({
            confirmId: confirmId
        }).catch(() => null);
        if (!oldJoinRequest) {
            throw new CustomError(
                CustomStatus.NOT_FOUND,
                new Error("Request not found")
            );
        }
        else if (oldJoinRequest.state !== "pending") {
            throw new CustomError(
                CustomStatus.ALREADY_CONFIRMED,
                new Error("Request already confirmed")
            );
        }

        const dataToSave = {
            state: accept === "true"
                ? "accepted"
                : ("rejected" as "accepted" | "rejected")
        };
        const savedData = await JoinRequestDB.write(dataToSave, {
            id: oldJoinRequest._id
        });

        if (savedData.state === "accepted") {
            await UserDB.write(
                {
                    // @ts-ignore
                    $addToSet: {
                        sig: oldJoinRequest.sig
                    }
                },
                {
                    id: oldJoinRequest.user
                }
            );
        }

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            state: savedData.state,
            data: savedData
        });
    }
    catch (error: any) {
        return res
            .status(HttpStatus.BAD_REQUEST)
            .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
