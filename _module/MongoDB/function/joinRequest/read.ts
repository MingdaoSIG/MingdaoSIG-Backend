import { ObjectId } from "mongoose";

import { JoinRequest } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export async function readById(id: string | ObjectId) {
    try {
        return await readData("_id", id);
    }
    catch (error: any) {
        throw new CustomError(
            CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
            error
        );
    }
}

export async function readByUserIdAndSigId(
    userId: string | ObjectId,
    sigId: string | ObjectId
) {
    try {
        const readByUser = await readData("user", userId);
        const readBySig = await readData("sig", sigId);

        if (readByUser && readBySig) {
            return readByUser;
        }
        else {
            throw new Error("JoinRequest not found");
        }
    }
    catch (error: any) {
        throw new CustomError(
            CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
            error
        );
    }
}

async function readData(key: string, value: any) {
    try {
        const data = await joinRequest.findOne({
            [key]: value,
            removed: false,
        });

        if (!data) {
            throw new Error("JoinRequest not found");
        }

        return data as unknown as JoinRequest;
    }
    catch (error: any) {
        throw new CustomError(
            CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
            error
        );
    }
}
