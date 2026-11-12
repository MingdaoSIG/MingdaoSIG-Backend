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

// might not work in the future (7 years from now)
export async function readByCode(code: string) {
  return await readData("code", code);
}

// Case-insensitive email match. Until duplicate users are merged, several
// documents can share an email; always pick the oldest so logins are stable.
export async function readOldestByEmail(email: string) {
  try {
    const data = await profile
      .findOne({ email: { $regex: `^${escapeRegex(email)}$`, $options: "i" } })
      .sort({ _id: 1 });

    return data as unknown as User | null;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readData(key: string, value: any) {
  try {
    // Sorted so duplicate emails/custom ids resolve to the same document
    const data = await profile.findOne({ [key]: value }).sort({ _id: 1 });

    if (!data) {
      throw new Error("User not found");
    }

    return data as unknown as User;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}
