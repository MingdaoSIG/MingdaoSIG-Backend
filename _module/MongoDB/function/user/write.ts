import { UserData } from "@type/user";
import { user } from "_module/MongoDB/function/_schema/user";


export default async function write(email: string, dataToSave: UserData): Promise<UserData> {
    try {
        const data = await user.findOne({ email }).exec();
        const code = data ? 1 : 0;
        if (code) {
            await user.findOneAndUpdate(
                { email },
                dataToSave
            );
        }
        else {
            await new user(dataToSave).save();
        }

        const newData: UserData = (await user.findOne({ email }))!;
        return newData;
    }
    catch (error: any) {
        throw new Error("Error writing user data");
    }
}