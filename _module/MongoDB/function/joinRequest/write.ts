import { JoinRequest } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(userId: string, dataToSave: JoinRequest) {
    try {
        const data = await joinRequest.findOne({ user: userId });
        const code = data ? 1 : 0;

        if (code) {
            return false;
        }
        else {
            return (await joinRequest.create(dataToSave))!;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_POST_TO_DB, error);
    }
}