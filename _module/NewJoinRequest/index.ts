import { isValidObjectId } from "mongoose";

import { Identity } from "@type/user";
import { JoinRequest } from "@type/joinRequest";
import { Sig } from "@type/sig";
import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { ADMIN_PERMISSION } from "@module/Permission";
import { SendPretty, SendText } from "@module/SendMail";

const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

export default async function NewJoinRequest(
  sigId: string,
  userId: string,
  requestMessage: JoinRequest,
) {
  try {
    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData || sigData.removed) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );
    }

    const userData = await UserDB.read({ id: userId }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );
    }

    const sigName = sigData.name;

    const targetEmails = await reviewerEmails(sigData);
    if (targetEmails.length === 0) {
      throw new Error("Nobody can review this join request");
    }

    await SendPretty({
      title: `${sigName} SIG 加入申請`,
      msg: {
        sig: {
          name: sigName,
        },
        user: {
          name: userData.name,
          identity: prettierIdentity(userData.identity),
          class: userData.class,
          email: userData.email,
        },
        question: {
          q1: requestMessage.q1,
          q2: requestMessage.q2,
          q3: requestMessage.q3,
        },
        confirmId: requestMessage.confirmId!,
      },
      to: targetEmails,
    });

    // The reviewers have the request; a failed receipt to the applicant must
    // not fail (and roll back) the application.
    await SendText(
      "SIG 申請遞交通知",
      `您的${sigName} SIG 加入申請已經成功遞交，請靜候審核。`,
      [userData.email],
    ).catch(() => {
      console.warn(
        "Join request saved, but the applicant receipt email failed",
      );
    });

    return true;
  } catch (error) {
    throw new CustomError(CustomStatus.FAILED_TO_SEND_EMAIL, error);
  }
}

/**
 * Who gets the request: the SIG's leaders and moderators (指導老師). A SIG
 * with neither (or whose accounts are gone) sends it to the platform admins
 * instead, so a request is never lost.
 */
async function reviewerEmails(sigData: Sig) {
  const reviewerIds = [
    ...(sigData.leader ?? []),
    ...(sigData.moderator ?? []),
  ].filter((id) => isValidObjectId(id));

  const reviewers =
    reviewerIds.length > 0
      ? await UserDB.list(
          { _id: { $in: reviewerIds } },
          { lean: true, projection: { email: 1 } },
        )
      : [];
  const emails = uniqueEmails(reviewers);
  if (emails.length > 0) return emails;

  const admins = await UserDB.list(
    { permission: ADMIN_PERMISSION },
    { lean: true, projection: { email: 1 } },
  );
  return uniqueEmails(admins);
}

function uniqueEmails(users: { email?: string }[]) {
  return Array.from(
    new Set(
      users
        .map((user) => user.email?.trim())
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

function prettierIdentity(identity: string) {
  const list: {
    [key in Identity as string]: string;
  } = {
    teacher: "老師",
    student: "學生",
    alumni: "校友",
  };

  return list[identity];
}
