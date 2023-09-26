import { Profile } from "@type/profile";
import profile from "@schema/profile";


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
            await new profile(dataToSave).save();
        }

        const newData: Profile = (await profile.findOne({ email }))!;
        return newData;
    }
    catch (error: any) {
        throw new Error("Error writing user data");
    }
}