import axios from "axios";

import { Identity } from "@type/user";
import CustomError from "@module/CustomError";
import MongoDB from "@module/MongoDB";
import { CustomStatus } from "@module/CustomStatusCode";
import UniqueId from "@module/UniqueId";
import CheckValidCustomId from "@module/CheckValidCustomId";


const UserDB = new MongoDB.User();

export default async function getUserData(email: string, avatar: string) {
  const MD_API_URL =
        "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/googleUserCheck";

  try {
    const response = await axios.postForm(MD_API_URL, {
      email
    });
    const responseData = response.data;

    const validData =
            checkData(responseData, [
              "code",
              "mail",
              "class_name",
              "user_name",
              "user_identity"
            ]) ||
            checkData(responseData, [
              "code",
              "mail",
              "user_name",
              "user_identity"
            ]) ||
            checkData(responseData, [
              "mail",
              "user_name",
              "user_job",
              "user_identity"
            ]);
    if (!validData) throw new Error("Invalid data");

    const prettierIdentity: { [key: string]: Identity } = {
      teach: "teacher",
      stu: "student",
      alu: "alumni"
    };
    const {
      mail,
      user_name,
      code,
      class_name,
      user_job,
      user_identity
    }: {
            mail: string;
            user_name: string;
            code: string;
            class_name: string;
            user_job: string;
            user_identity: "teach" | "stu" | "alu";
        } = responseData;

    const oldData = await UserDB.read({ email: mail }).catch(() => null);

    const customId = oldData?.customId || mail.split("@")[0].toLowerCase();
    let targetCustomId = customId;
    let validId = oldData?.customId
      ? true
      : await _CheckValidCustomId(targetCustomId);
    do {
      if (validId) break;
      targetCustomId = `${customId}_${UniqueId(5)}`;
      validId = await _CheckValidCustomId(targetCustomId);
    } while (!validId);

    const sig = oldData?.sig || [];
    const displayName = oldData?.displayName || user_name;
    const description = oldData?.description || "";
    const follower = oldData?.follower || [];
    // const permission = oldData?.permission || 1;

    const newData = {
      customId: targetCustomId,
      email: mail,
      name: user_name,
      code: code || "",
      class: class_name || user_job || "",
      identity: prettierIdentity[user_identity],
      sig: sig,
      displayName: displayName,
      description: description,
      avatar: avatar,
      follower: follower
      // permission: permission
    };
    const savedData = await UserDB.write(newData, { email });

    return savedData;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_USER, error);
  }
}

export async function getUserDataBySession(session: string) {
  console.log("Get user data by session:", session);
  const MD_API_URL =
        "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sessUserCheck";

  try {
    const response = await axios.postForm(MD_API_URL, {
      sess: session
    });
    const responseData = response.data;

    const validData =
            checkData(responseData, [
              "code",
              "mail",
              "class_name",
              "user_name",
              "user_identity"
            ]) ||
            checkData(responseData, [
              "code",
              "mail",
              "user_name",
              "user_identity"
            ]) ||
            checkData(responseData, [
              "mail",
              "user_name",
              "user_job",
              "user_identity"
            ]);
    if (!validData) throw new Error("Invalid data");

    const prettierIdentity: { [key: string]: Identity } = {
      teach: "teacher",
      stu: "student",
      alu: "alumni"
    };
    const {
      mail,
      user_name,
      code,
      class_name,
      user_job,
      user_identity
    }: {
            mail: string;
            user_name: string;
            code: string;
            class_name: string;
            user_job: string;
            user_identity: "teach" | "stu" | "alu";
        } = responseData;

    const lowMail = mail.toLowerCase();

    const oldData = await UserDB.read({ email: lowMail }).catch(() => null);

    const customId = oldData?.customId || mail.split("@")[0].toLowerCase();
    let targetCustomId = customId;
    let validId = oldData?.customId
      ? true
      : await _CheckValidCustomId(targetCustomId);
    do {
      if (validId) break;
      targetCustomId = `${customId}_${UniqueId(5)}`;
      validId = await _CheckValidCustomId(targetCustomId);
    } while (!validId);

    const sig = oldData?.sig || [];
    const displayName = oldData?.displayName || user_name;
    const description = oldData?.description || "";
    const follower = oldData?.follower || [];
    const avatar =
            oldData?.avatar ||
            "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg";
    // const permission = oldData?.permission || 1;

    const newData = {
      customId: targetCustomId,
      email: lowMail,
      name: user_name,
      code: code || "",
      class: class_name || user_job || "",
      identity: prettierIdentity[user_identity],
      sig: sig,
      displayName: displayName,
      description: description,
      avatar: avatar,
      follower: follower
      // permission: permission
    };
    const savedData = await UserDB.write(newData, {
      email: lowMail
    });

    return savedData;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_USER, error);
  }
}

function checkData(data: object, keys: string[]) {
  // Check if input is an object
  if (typeof data !== "object") throw new Error("Not a object");

  // Check if object have all required keys
  if (Object.keys(data).length !== keys.length) return false;
  for (const key of keys) {
    if (!(key in data)) return false;
  }

  return true;
}

async function _CheckValidCustomId(customId: string) {
  try {
    await CheckValidCustomId(customId);
    return true;
  }
  catch (error) {
    return false;
  }
}
