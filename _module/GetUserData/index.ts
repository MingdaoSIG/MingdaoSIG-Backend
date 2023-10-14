import axios from "axios";

import { Identity, User } from "@type/user";
import CustomError from "@type/customError";
import MongoDB from "@module/MongoDB";
import { CustomStatus } from "@module/CustomStatusCode";
import UniqueId from "@module/UniqueId";


const UserDB = new MongoDB("user");

export default async function getUserData(email: string, avatar: string): Promise<User> {
    const MD_API_URL = "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/googleUserCheck";

    try {
        const response = await axios.postForm(MD_API_URL, {
            email
        });

        const responseData = response.data;

        try {
            checkData(responseData, ["code", "mail", "class_name", "user_name", "user_identity"]);
        }
        catch (error) {
            checkData(responseData, ["code", "mail", "user_name", "user_identity"]);
        }
        const prettierIdentity: { [key: string]: Identity } = {
            teach: "teacher",
            stu: "student"
        };
        const { mail, user_name, code, class_name, user_identity } = responseData;

        const oldData: User | null = await UserDB.read({ email }).catch(() => null);

        let customId = oldData?.customId?.toLowerCase();
        let haveId: User | null = null;
        do {
            if (customId) break;
            customId = `${code.toLowerCase()}_${UniqueId(5)}`;
            haveId = await UserDB.read({ customId }).catch(() => null);
        } while (haveId);

        const sig = user_identity === "sig" ? [] : (oldData?.sig || []);
        const displayName = user_identity === "sig" ? user_name : oldData?.displayName || user_name;
        const description = oldData?.description || "";
        const follower = oldData?.follower || [];
        const permission = oldData?.permission || 1;

        const newData: User = {
            customId: customId,
            email: mail,
            name: user_name,
            code: code,
            class: class_name || "",
            identity: prettierIdentity[user_identity],
            sig: sig,
            displayName: displayName,
            description: description,
            avatar: avatar,
            follower: follower,
            permission: permission
        };
        const savedData: User = await UserDB.write(newData, { email });

        return savedData;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.INVALID_USER, error);
    }
}

function checkData(data: object, keys: string[]) {
    // Check if input is an object
    if (typeof data != "object") throw new Error("Not a object");

    // Check if object have all required keys
    if (Object.keys(data).length != keys.length) throw new Error("Invalid data");
    for (const key of keys) {
        if (!(key in data)) throw new Error("Invalid data");
    }

    return true;
}