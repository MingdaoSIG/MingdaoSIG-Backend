import axios from "axios";

import CustomError from "@type/customError";
import { GoogleUserData } from "@type/googleUserData";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function getGoogleUserData(googleToken: string): Promise<GoogleUserData> {
    const GOOGLE_API_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    try {
        const response = await axios.get(GOOGLE_API_URL, {
            params: {
                access_token: googleToken
            }
        });

        const userDataKeys = Object.keys(response.data) as (keyof GoogleUserData)[];
        checkData(response.data, userDataKeys);

        return { ...response.data, picture: response.data.picture.split("=")[0] } as GoogleUserData;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.INVALID_GOOGLE_ACCESS_TOKEN, error);
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