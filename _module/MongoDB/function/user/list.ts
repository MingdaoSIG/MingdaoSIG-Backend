import CustomError from "@type/customError";
import user from "@schema/user";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: object) {
    try {
        const data = await user.find(search);

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}