import axios from "axios";

import { Identity, Profile } from "@type/profile";
import CustomError from "@type/customError";
import MongoDB from "@module/MongoDB";
import { CustomStatus } from "@module/CustomStatusCode";


const UserDB = new MongoDB("profile");

export async function getUserData(email: string, avatar: string): Promise<Profile> {
    const MD_API_URL = "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/googleUserCheck";

    try {
        // Check user email
        email = email.toLowerCase();
        if (!email || !email.includes("@")) throw new Error("Invalid email");
        if (email.split("@")[1] != "ms.mingdao.edu.tw") throw new Error("Invalid email");

        const response = await axios.postForm(MD_API_URL, {
            email
        });

        const responseData = response.data;
        checkData(responseData, ["code", "mail", "class_name", "user_name", "user_identity"]);

        const prettierIdentity: { [key: string]: Identity } = {
            teach: "teacher",
            stu: "student"
        };

        const { mail, user_name, code, class_name, user_identity } = responseData;

        const oldData = await UserDB.read(email).catch(() => null);
        const sig = user_identity === "sig" ? [] : (oldData?.sig || []);
        const displayName = user_identity === "sig" ? user_name : oldData?.displayName || user_name;
        const description = oldData?.description || "";
        const follower = oldData?.follower || [];
        const permission = oldData?.permission || 1;

        const newData: Profile = {
            email: mail,
            name: user_name,
            code: code,
            class: class_name,
            identity: prettierIdentity[user_identity],
            sig: sig,
            displayName: displayName,
            description: description,
            avatar: avatar,
            follower: follower,
            permission: permission
        };
        const savedData = await UserDB.write(email, newData);

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