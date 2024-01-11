import { Identity } from "@type/user";
import { JoinRequest } from "@type/joinRequest";
import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { SendPretty, SendText } from "@module/SendMail";


const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export default async function NewJoinRequest(
    sigId: string,
    userId: string,
    requestMessage: JoinRequest
) {
    try {
        const sigData = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData || sigData.removed) {
            throw new CustomError(
                CustomStatus.INVALID_SIG_ID,
                new Error("Invalid sig id")
            );
        }

        const userData = await UserDB.read({ id: userId }).catch(() => null);
        if (!userData) {
            throw new CustomError(
                CustomStatus.INVALID_USER_ID,
                new Error("Invalid user id")
            );
        }

        const sigName = sigData.name;

        const targetEmails = Array.from(
            new Set(
                await Promise.all(
                    sigData.leader?.map(async leaderId => {
                        const leaderData = await UserDB.read({ id: leaderId });
                        return leaderData.email;
                    }) ?? []
                )
            )
        ).filter(item => item !== undefined);

        await SendPretty({
            title: `${sigName} SIG 加入申請`,
            msg: {
                sig: {
                    name: sigName
                },
                user: {
                    name: userData.name,
                    identity: prettierIdentity(userData.identity),
                    class: userData.class,
                    email: userData.email
                },
                question: {
                    q1: requestMessage["q1"],
                    q2: requestMessage["q2"],
                    q3: requestMessage["q3"]
                },
                confirmId: requestMessage["confirmId"]!
            },
            to: targetEmails
        });

        await SendText(
            "SIG 申請遞交通知",
            `您的${sigName} SIG 加入申請已經成功遞交至 SIG Leader，請靜候 Leader 審核。`,
            [userData.email]
        );

        return true;
    }
    catch (error) {
        throw new CustomError(CustomStatus.FAILED_TO_SEND_EMAIL, error);
    }
}

function prettierIdentity(identity: string) {
    const list: {
        [key in Identity as string]: string;
    } = {
        teacher: "老師",
        student: "學生",
        alumni: "校友"
    };

    return list[identity];
}
