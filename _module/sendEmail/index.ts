import axios from "axios";

import { JoinSigRequestMessage } from "@type/joinSigRequest";
import { Sig } from "@type/sig";
import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { User } from "@type/user";


const SigDB = new MongoDB("sig");
const UserDB = new MongoDB("user");

export default async function JoinSigRequest(sigId: string, userId: string, requestMessage: JoinSigRequestMessage) {
    const MD_API_URL = "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sendMail";

    try {
        const sigData: Sig | null = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData || sigData.removed) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const userData: User | null = await UserDB.read({ id: userId }).catch(() => null);
        if (!userData) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const sigName = sigData.name;
        const prettyRequestMessage = parseRequestMessage(userData, requestMessage);
        const targetEmails = Array.from(new Set(
            await Promise.all(sigData.leader?.map(async leaderId => {
                const leaderData: User = await UserDB.read({ id: leaderId });
                return leaderData.email;
            }) ?? [])
        ));

        const requestBody = {
            "from": "SIG 2.0 工作小組",
            "title": `${sigName} SIG 加入申請`,
            "msg": prettyRequestMessage,
            "to": targetEmails.join(",")
        };
        const response = await axios.postForm(MD_API_URL, requestBody);
        if (targetEmails.join("") !== response.data || response.status !== 200) {
            throw new CustomError(CustomStatus.ERROR_SENDING_EMAIL, new Error("Error sending email"));
        }

        return true; // TODO: requestId: string
    }
    catch (error) {
        throw new CustomError(CustomStatus.ERROR_SENDING_EMAIL, error);
    }
}

function parseRequestMessage(userData: User, requestMessage: JoinSigRequestMessage) {
    const questions = {
        q1: "問題一 :",
        q2: "問題二 :",
        q3: "問題三 :"
    };

    const message = [];
    message.push([
        "申請人資料",
        `姓名：${userData.name}`,
        `身分：${userData.identity}`,
        `學號：${userData.code}`,
        `信箱：${userData.email}`
    ].join("\n"));
    for (const [key, value] of Object.entries(questions)) {
        if (requestMessage[key]) {
            message.push(`${value}\n${requestMessage[key]}`);
        }
    }

    return message.join("\n\n");
}