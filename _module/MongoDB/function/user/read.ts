import CustomError from "@type/customError";
import profile from "@schema/profile";

import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(email: string) {
    try {
        const data = await profile.findOne({ email });

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}