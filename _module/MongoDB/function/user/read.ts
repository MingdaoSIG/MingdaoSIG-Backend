import CustomError from "@type/customError";
import profile from "@schema/profile";

import { CustomStatus } from "@module/CustomStatusCode";


export async function readByEmail(email: string) {
    return await _readData("email", email);
}

export async function readById(id: string) {
    return await _readData("_id", id);
}

export async function readByCustomId(id: string) {
    return await _readData("customId", id);
}

async function _readData(key: string, value: any) {
    try {
        const data = await profile.findOne({ [key]: value });

        if (!data) {
            throw new Error("User not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
    }
}