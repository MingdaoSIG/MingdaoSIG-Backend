import CustomError from "@type/customError";
import { Profile } from "@type/profile";

import { CustomStatus } from "@module/CustomStatusCode";
import profile from "@schema/profile";


export default async function read(id: string): Promise<Profile> {
    try {
        const data: Profile = (await profile.findOne({ email: id }))!;

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}