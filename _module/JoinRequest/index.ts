import { JoinRequestWrite } from "@type/joinRequest";
import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { Identity, User } from "@type/user";
import SendMail from "@module/SendMail";


const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export default async function JoinRequest(sigId: string, userId: string, requestMessage: JoinRequestWrite) {
    try {
        const sigData = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData || sigData.removed) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const userData = await UserDB.read({ id: userId }).catch(() => null);
        if (!userData) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const sigName = sigData.name;
        if (!sigName) throw new Error("Invalid sig name");
        const prettyRequestMessage = parseRequestMessage(sigName, userData, requestMessage);
        const targetEmails = Array.from(new Set(
            await Promise.all(sigData.leader?.map(async leaderId => {
                const leaderData = await UserDB.read({ id: leaderId });
                return leaderData.email;
            }) ?? [])
        )).filter(item => item !== undefined) as string[];

        await SendMail(
            `${sigName} SIG 加入申請`,
            prettyRequestMessage,
            targetEmails
        );

        return true; // TODO: requestId: string
    }
    catch (error) {
        throw new CustomError(CustomStatus.FAILED_TO_SEND_EMAIL, error);
    }
}

function parseRequestMessage(sigName: string, userData: User, requestMessage: JoinRequestWrite) {
    const prettierIdentity: {
        [key in Identity]: string
    } = {
        teacher: "老師",
        student: "學生",
        alumni: "校友"
    };

    const message: string[] = [];
    message.push([
        "SIG Leader 您好，",
        `我們希望您一切順利，特此通知您，您的 ${sigName} SIG 有新的加入申請。`
    ].join("\n"));
    message.push([
        "以下是申請人的詳細資訊：",
        `姓名：${userData.name}`,
        `身分：${prettierIdentity[userData.identity]}`,
        `班級：${userData.class}`,
        `信箱：${userData.email}`
    ].join("\n"));
    message.push([
        "自我介紹：",
        requestMessage["q1"]
    ].join("\n"));
    message.push([
        "申請加入原因：",
        requestMessage["q2"]
    ].join("\n"));
    message.push([
        "感興趣的議題：",
        requestMessage["q3"]
    ].join("\n"));
    message.push(
        "非常感謝您能夠儘快審核並回覆此申請。如果您有任何問題或需要進一步的資訊，請隨時與我們聯繫。"
    );
    message.push(
        "祝順利！"
    );
    message.push(
        "SIG 平台開發團隊"
    );

    return message.join("\n\n");
}