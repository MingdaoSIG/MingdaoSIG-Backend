import { CustomStatus } from "@module/CustomStatusCode";
import { profile } from "@schema/user";
import CustomError from "@type/customError";
import { Profile } from "@type/profile";


export default async function read(email: string): Promise<Profile> {
    try {
        const data: Profile = (await profile.findOne({ email }))!;

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}