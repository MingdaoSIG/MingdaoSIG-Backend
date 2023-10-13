import MongoDB from "@module/MongoDB";


const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

export default async function CheckExistsCustomId(customId: string) {
    const userData = await UserDB.read({ customId }).catch(() => null);
    const sigData = await SigDB.read({ customId }).catch(() => null);

    return userData || sigData;
}