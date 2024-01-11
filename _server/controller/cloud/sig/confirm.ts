import { RequestHandler } from "express";

import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { SendText } from "@module/SendMail";


const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();
const JoinRequestDB = new MongoDB.JoinRequest();

export const confirmJoinRequest: RequestHandler = async (req, res) => {
    try {
        const confirmId = req.params.confirmId;
        const accept = req.query.accept;

        if (accept !== "true" && accept !== "false") {
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
            state:
                accept === "true"
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

        await sendNotification(
            oldJoinRequest.user,
            oldJoinRequest.sig,
            savedData.state
        );

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

async function sendNotification(userId: string, sigId: string, state: string) {
    const userData = await UserDB.read({ id: userId }).catch(() => null);
    if (!userData) {
        throw new CustomError(
            CustomStatus.FAILED_TO_SEND_EMAIL,
            new Error("Can't read user email")
        );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
        throw new CustomError(
            CustomStatus.FAILED_TO_SEND_EMAIL,
            new Error("Can't read sig name")
        );
    }

    const sigName = sigData.name;
    const userEmail = userData.email;
    await SendText(
        "SIG 申請結果通知",
        `您的${sigName} SIG 加入申請${
            state === "accepted" ? "已通過" : "被拒絕"
        }。`,
        [userEmail]
    );
}
