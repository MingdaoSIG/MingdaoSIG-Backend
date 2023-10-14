import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

export default async function CheckValidCustomId(customId: string) {
    CheckPattern(customId);
    await CheckExists(customId);
}

function CheckPattern(customId: string) {
    const regex = /^(?=.{1,25}$)[a-z0-9_]+(\.[a-z0-9_]+)*$/gm;
    if (customId && !regex.test(customId)) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid custom id"));
}

async function CheckExists(customId: string) {
    const userData = await UserDB.read({ customId }).catch(() => null);
    const sigData = await SigDB.read({ customId }).catch(() => null);

    const alreadyExists = userData || sigData;

    if (alreadyExists) throw new CustomError(CustomStatus.CUSTOM_ID_ALREADY_EXISTS, new Error("Custom id already exists"));
}