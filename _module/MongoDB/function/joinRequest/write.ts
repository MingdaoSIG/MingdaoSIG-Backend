import { ObjectId } from "mongoose";

import { JoinRequest, JoinRequestWrite } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(
    id: string | ObjectId | null,
    dataToSave: JoinRequestWrite
) {
    try {
        const data = await joinRequest.findOne({ _id: id });
        const code = data ? 1 : 0;

        if (code) {
            return joinRequest.findOneAndUpdate({ _id: id }, dataToSave, {
                new: true
            }) as unknown as JoinRequest;
        }
        else {
            return (await joinRequest.create(
                dataToSave
            )) as unknown as JoinRequest;
        }
    }
    catch (error: any) {
        throw new CustomError(
            CustomStatus.ERROR_WRITING_JOIN_REQUEST_TO_DB,
            error
        );
    }
}
