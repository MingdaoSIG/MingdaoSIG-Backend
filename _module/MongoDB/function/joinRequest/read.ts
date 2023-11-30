import { ObjectId } from "mongoose";

import { JoinRequest } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(id: string | ObjectId) {
    try {
        const data = await joinRequest.findOne({ _id: id, removed: false });

        if (!data) {
            throw new Error("JoinRequest not found");
        }

        return data as unknown as JoinRequest;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB, error);
    }
}