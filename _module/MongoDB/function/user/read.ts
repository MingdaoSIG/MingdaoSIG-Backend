import { CustomStatus } from "@module/CustomStatusCode";
import { user } from "@schema/user";
import CustomError from "@type/customError";
import { UserData } from "@type/user";


export default async function read(email: string): Promise<UserData> {
    try {
        const data: UserData = (await user.findOne({ email }))!;

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}