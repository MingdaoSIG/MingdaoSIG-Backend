import axios from "axios";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


const MD_API_URL = "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sendMail";

export default async function SendMail(title: string, msg: string, target: string[]) {
    try {
        const requestBody = {
            "from": "SIG 平台開發團隊",
            "title": title,
            "msg": msg,
            "to": target.join(",")
        };
        const response = await axios.postForm(MD_API_URL, requestBody);
        if (target.join("") !== response.data || response.status !== 200) {
            throw new Error("Error sending email");
        }
        return true;
    }
    catch (error) {
        throw new CustomError(CustomStatus.ERROR_SENDING_EMAIL, error);
    }
}