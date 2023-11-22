import { UserWrite } from "@type/user";
import profile from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export async function writeById(id: string, dataToSave: UserWrite) {
    return await _writeData("_id", id, dataToSave);
}

export async function writeByEmail(email: string, dataToSave: UserWrite) {
    return await _writeData("email", email, dataToSave);
}

async function _writeData(key: string, value: any, dataToSave: UserWrite) {
    try {
        const data = await profile.findOne({ [key]: value });
        const code = data ? 1 : 0;

        if (code) {
            return (await profile.findOneAndUpdate(
                { [key]: value },
                dataToSave,
                {
                    new: true
                }
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