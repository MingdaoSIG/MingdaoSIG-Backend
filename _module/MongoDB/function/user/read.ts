import { User } from "@type/user";
import profile from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export async function readByEmail(email: string) {
  return await readData("email", email);
}

export async function readById(id: string) {
  return await readData("_id", id);
}

export async function readByCustomId(id: string) {
  return await readData("customId", id);
}

export async function readByCode(code: string) {
  return await readData("code", code);
}

async function readData(key: string, value: any) {
  try {
    const data = await profile.findOne({ [key]: value });

    if (!data) {
      throw new Error("User not found");
    }

    return data as unknown as User;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}
