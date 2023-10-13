import CustomError from "@type/customError";
import sig from "@schema/sig";
import { CustomStatus } from "@module/CustomStatusCode";


export async function readById(id: string) {
    return await _readData("_id", id);
}

export async function readByCustomId(id: string) {
    return await _readData("customId", id);
}

async function _readData(key: string, value: any) {
    try {
        const data = await sig.findOne({ [key]: value });

        if (!data) {
            throw new Error("Sig not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
    }
}