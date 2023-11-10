import { User } from "@type/user";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(id: string, dataToSave: User) {
    try {
        const data = await sig.findOne({ ["_id"]: id });
        const code = data ? 1 : 0;

        if (code) {
            return (await sig.findOneAndUpdate(
                { ["_id"]: id },
                dataToSave,
                {
                    new: true
                }
            ))!;
        }
        else {
            return (await sig.create(dataToSave))!;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_SIG_TO_DB, error);
    }
}