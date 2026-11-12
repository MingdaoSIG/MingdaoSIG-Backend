import axios from "axios";

import { Identity, User, UserWrite } from "@type/user";
import CustomError from "@module/CustomError";
import MongoDB from "@module/MongoDB";
import { CustomStatus } from "@module/CustomStatusCode";
import UniqueId from "@module/UniqueId";
import CheckValidCustomId from "@module/CheckValidCustomId";

const UserDB = new MongoDB.User();

const MD_GOOGLE_USER_CHECK_URL =
  "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/googleUserCheck";
const MD_SESSION_USER_CHECK_URL =
  "https://mdsrl.mingdao.edu.tw/mdpp/Sig20Login/sessUserCheck";
const DEFAULT_AVATAR =
  "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg";

const CUSTOM_ID_MAX_LENGTH = 25;
const CUSTOM_ID_SUFFIX_LENGTH = 5;
const CUSTOM_ID_MAX_ATTEMPTS = 10;
const CREATE_MAX_ATTEMPTS = 5;

type MdProfile = {
  email: string; // lowercased
  name: string;
  code: string;
  className: string;
  identity: Identity;
};

export default async function getUserData(email: string, avatar: string) {
  try {
    const response = await axios.postForm(MD_GOOGLE_USER_CHECK_URL, {
      email,
    });
    const profile = parseMdProfile(response.data);

    return await loginUser(profile, avatar);
  } catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_USER, error);
  }
}

export async function getUserDataBySession(session: string) {
  try {
    const response = await axios.postForm(MD_SESSION_USER_CHECK_URL, {
      sess: session,
    });
    const profile = parseMdProfile(response.data);

    return await loginUser(profile);
  } catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_USER, error);
  }
}

function parseMdProfile(responseData: any): MdProfile {
  const validData =
    checkData(responseData, [
      "code",
      "mail",
      "class_name",
      "user_name",
      "user_identity",
    ]) ||
    checkData(responseData, ["code", "mail", "user_name", "user_identity"]) ||
    checkData(responseData, ["mail", "user_name", "user_job", "user_identity"]);
  if (!validData) throw new Error("Invalid data");

  const prettierIdentity: { [key: string]: Identity } = {
    teach: "teacher",
    stu: "student",
    alu: "alumni",
  };
  const {
    mail,
    user_name,
    code,
    class_name,
    user_job,
    user_identity,
  }: {
    mail: string;
    user_name: string;
    code: string;
    class_name: string;
    user_job: string;
    user_identity: "teach" | "stu" | "alu";
  } = responseData;

  return {
    email: String(mail).trim().toLowerCase(),
    name: user_name,
    code: code || "",
    className: class_name || user_job || "",
    identity: prettierIdentity[user_identity],
  };
}

// Logins for the same email share one in-flight lookup/creation, so parallel
// requests (the frontend logs in from several components at once) cannot each
// create a user. This relies on the backend running as a single process.
const inflightLogins = new Map<string, Promise<User>>();

function loginUser(profile: MdProfile, avatar?: string) {
  const running = inflightLogins.get(profile.email);
  if (running) return running;

  const task = (async () => {
    try {
      return await resolveLoginUser(profile, avatar);
    } finally {
      inflightLogins.delete(profile.email);
    }
  })();
  inflightLogins.set(profile.email, task);
  return task;
}

async function resolveLoginUser(profile: MdProfile, avatar?: string) {
  const existing = await UserDB.readOldestByEmail(profile.email);
  if (existing?.customId) {
    return await updateLoginUser(existing, profile, avatar);
  }

  // Creating a user picks a custom id; doing it one at a time keeps two new
  // users with the same email prefix from claiming the same id.
  return await withCreationLock(() => createLoginUser(profile, avatar));
}

let creationQueue: Promise<unknown> = Promise.resolve();

function withCreationLock<T>(task: () => Promise<T>): Promise<T> {
  const run = creationQueue.then(task);
  creationQueue = run.catch(() => undefined);
  return run;
}

async function createLoginUser(profile: MdProfile, avatar?: string) {
  for (let attempt = 0; attempt < CREATE_MAX_ATTEMPTS; attempt++) {
    // Re-read inside the lock: a creation that finished meanwhile wins.
    const existing = await UserDB.readOldestByEmail(profile.email);
    if (existing?.customId) {
      return await updateLoginUser(existing, profile, avatar);
    }

    const customId = await pickCustomId(profile.email);
    try {
      if (existing) {
        // Legacy document without a custom id
        return await updateLoginUser(existing, profile, avatar, { customId });
      }

      return await UserDB.upsertByEmail(
        profile.email,
        loginFields(profile, avatar),
        {
          customId,
          sig: [],
          displayName: profile.name,
          description: "",
          follower: [],
        },
      );
    } catch (error) {
      // Only possible once unique indexes exist. Duplicate email: another
      // process created the user, so the next pass reads it. Duplicate custom
      // id: the next pass picks another one.
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  throw new Error("Could not create user");
}

function loginFields(
  profile: MdProfile,
  avatar?: string,
  existing?: User | null,
): UserWrite {
  return {
    name: profile.name,
    code: profile.code,
    class: profile.className,
    identity: profile.identity,
    avatar: avatar || existing?.avatar || DEFAULT_AVATAR,
  };
}

async function updateLoginUser(
  existing: User,
  profile: MdProfile,
  avatar?: string,
  extra: UserWrite = {},
) {
  return await UserDB.write(
    {
      ...loginFields(profile, avatar, existing),
      displayName: existing.displayName || profile.name,
      ...extra,
    },
    { id: existing._id },
  );
}

function isDuplicateKeyError(error: any) {
  return error?.code === 11000 || error?.error?.code === 11000;
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
async function pickCustomId(email: string) {
  const base = sanitizeCustomIdBase(email);

  const plain = trimCustomId(base, CUSTOM_ID_MAX_LENGTH);
  if (await _CheckValidCustomId(plain)) return plain;

  const stem = trimCustomId(
    base,
    CUSTOM_ID_MAX_LENGTH - CUSTOM_ID_SUFFIX_LENGTH - 1,
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
  } catch (error) {
    return false;
  }
}
