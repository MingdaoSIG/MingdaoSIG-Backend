import axios from "axios";

import MongoDB from "@module/MongoDB";
import { Identity, UserData } from "@type/user";


const UserDB = new MongoDB("user");

export async function getUserData(email: string): Promise<UserData> {
    const MD_API_URL = "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/googleUserCheck";

    try {
        // Check user email
        email = email.toLowerCase();
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
        const oldData = await UserDB.read(email);
        const newData: UserData = {
            email: responseData.mail,
            name: responseData.user_name,
            code: responseData.code,
            class: responseData.class_name,
            identity: prettierIdentity[responseData.user_identity],
            displayName: oldData ? oldData.displayName : responseData.user_name,
        };

        const savedData = await UserDB.write(email, newData);

        return savedData;
    }
    catch (error) {
        throw new Error("Invalid user");
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