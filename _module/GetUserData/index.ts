import axios from "axios";

import { Identity } from "@type/user";
import CustomError from "@module/CustomError";
import MongoDB from "@module/MongoDB";
import { CustomStatus } from "@module/CustomStatusCode";
import UniqueId from "@module/UniqueId";
import CheckValidCustomId from "@module/CheckValidCustomId";


const UserDB = new MongoDB.User();

const CUSTOM_ID_MAX_LENGTH = 25;
const CUSTOM_ID_SUFFIX_LENGTH = 5;
const CUSTOM_ID_MAX_ATTEMPTS = 10;

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

    const targetCustomId = oldData?.customId || (await pickCustomId(mail));

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

    const targetCustomId = oldData?.customId || (await pickCustomId(mail));

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

/**
 * Builds a custom id from the email's local part that matches the pattern in
 * CheckValidCustomId (lowercase a-z, 0-9, _ and single inner dots, at most
 * 25 characters), adding a random suffix when it is taken. Gives up after a
 * fixed number of attempts instead of looping forever.
 */
export async function pickCustomId(email: string) {
  const base = sanitizeCustomIdBase(email);

  const plain = trimCustomId(base, CUSTOM_ID_MAX_LENGTH);
  if (await _CheckValidCustomId(plain)) return plain;

  const stem = trimCustomId(
    base,
    CUSTOM_ID_MAX_LENGTH - CUSTOM_ID_SUFFIX_LENGTH - 1
  );
  for (let attempt = 0; attempt < CUSTOM_ID_MAX_ATTEMPTS; attempt++) {
    const candidate = `${stem}_${UniqueId(CUSTOM_ID_SUFFIX_LENGTH)}`;
    if (await _CheckValidCustomId(candidate)) return candidate;
  }

  throw new Error("Could not generate a unique custom id");
}

function sanitizeCustomIdBase(email: string) {
  return (
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, "_")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "") || "user"
  );
}

function trimCustomId(base: string, maxLength: number) {
  return base.slice(0, maxLength).replace(/\.+$/, "") || "user";
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
