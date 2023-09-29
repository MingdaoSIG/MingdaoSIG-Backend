import { Profile } from "@type/profile";
import profile from "@schema/profile";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(email: string, dataToSave: Profile) {
    try {
        const data = await profile.findOne({ email }).exec();
        const code = data ? 1 : 0;

        if (code) {
            return (await profile.findOneAndUpdate(
                { email },
                dataToSave
            ))!;
        }
        else {
            return (await profile.create(dataToSave))!;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
    }
}