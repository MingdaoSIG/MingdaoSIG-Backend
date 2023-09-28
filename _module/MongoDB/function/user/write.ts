import { Profile } from "@type/profile";
import profile from "@schema/profile";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(email: string, dataToSave: Profile): Promise<Profile> {
    try {
        const data = await profile.findOne({ email }).exec();
        const code = data ? 1 : 0;

        if (code) {
            await profile.findOneAndUpdate(
                { email },
                dataToSave
            );
        }
        else {
            await profile.create(dataToSave);
        }

        const newData: Profile = (await profile.findOne({ email }))!;
        return newData;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_USER_TO_DB, error);
    }
}