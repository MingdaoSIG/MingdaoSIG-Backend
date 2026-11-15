import axios from "axios";

import { MailApiRequest } from "@type/mailApiRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

/**
 * `MAIL_DISABLED=true` turns every email off (set on beta, which runs on a
 * copy of the prod data with real addresses). A skipped send counts as sent,
 * so callers behave as they would on prod; only the recipient count is logged.
 */
function mailDisabled(kind: string, recipients: number) {
  if (process.env.MAIL_DISABLED?.trim().toLowerCase() !== "true") return false;
  console.log(
    `Mail : disabled, skipped a ${kind} email to ${recipients} recipient(s)`,
  );
  return true;
}

const MAIL_PRETTY_API_URL =
  "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sendMail";

export async function SendPretty(content: MailApiRequest) {
  if (mailDisabled("join request", content.to?.length ?? 0)) return true;
  try {
    const {
      from = "SIG 平台開發團隊",
      title,
      msg: {
        sig: { name: sigName },
        user: { name: userName, identity, class: userClass, email },
        question: { q1, q2, q3 },
      },
      to,
    } = content;

    const requestBody = {
      from,
      title,
      msg: {
        sig: { name: sigName },
        user: { name: userName, identity, class: userClass, email },
        question: { q1, q2, q3 },
        button: {
          decline: `${process.env.FRONTEND_BASE_URL}/confirm/?confirmId=${content.msg.confirmId}&accept=false`,
          accept: `${process.env.FRONTEND_BASE_URL}/confirm/?confirmId=${content.msg.confirmId}&accept=true`,
        },
      },
      to: to.join(","),
    };
    const response = await axios.post(MAIL_PRETTY_API_URL, requestBody);

    if (content.to.join("") !== response.data || response.status !== 200) {
      throw new Error("Error sending email");
    }
    return true;
  } catch (error) {
    throw new CustomError(CustomStatus.FAILED_TO_SEND_EMAIL, error);
  }
}

const MAIL_TEXT_API_URL =
  "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sendMailText";

export async function SendText(
  title: string,
  message: string,
  target: string[],
) {
  if (mailDisabled("text", target.length)) return true;
  try {
    const requestBody = {
      from: "SIG 平台開發團隊",
      title: title,
      msg: message,
      to: target.join(","),
    };
    const response = await axios.post(MAIL_TEXT_API_URL, requestBody);
    if (response.data !== "" || response.status !== 200) {
      throw new Error("Error sending email");
    }
    return true;
  } catch (error) {
    throw new CustomError(CustomStatus.FAILED_TO_SEND_EMAIL, error);
  }
}
