import { ObjectId } from "mongoose";

import { Sig } from "@type/sig";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export async function readById(id: string | ObjectId) {
    return await _readData("_id", id);
}

export async function readByCustomId(id: string | ObjectId) {
    return await _readData("customId", id);
}

async function _readData(key: string, value: any) {
    try {
        const data = await sig.findOne({ [key]: value });

        if (!data) {
            throw new Error("Sig not found");
        }

        return data as unknown as Sig;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
    }
}