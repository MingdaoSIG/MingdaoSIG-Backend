import axios, { AxiosResponse } from "axios";

import { GoogleUserData } from "@type/googleUserData";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

// Comma-separated OAuth client ids whose access tokens are accepted. Read on
// use, because .env is loaded after this module.
function allowedGoogleClientIds() {
  return (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

// Runs once after start-up code (including loading .env) has finished.
setImmediate(() => {
  if (allowedGoogleClientIds().length === 0) {
    console.warn(
      "GOOGLE_CLIENT_IDS is not set: Google access tokens are accepted without checking which client they were issued to.",
    );
  }
});

export default async function getGoogleUserData(
  googleToken: string,
): Promise<GoogleUserData> {
  try {
    const clientIds = allowedGoogleClientIds();

    const [response] = await Promise.all([
      axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${googleToken}` },
      }),
      clientIds.length > 0
        ? checkAudience(googleToken, clientIds)
        : Promise.resolve(),
    ]);

    const userDataKeys = Object.keys(response.data) as (keyof GoogleUserData)[];
    checkData(response.data, userDataKeys);

    return {
      ...response.data,
      picture: response.data.picture.split("=")[0],
    } as GoogleUserData;
  } catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_GOOGLE_ACCESS_TOKEN, error);
  }
}

// A valid token issued to another app must not log in here. Both failures
// are logged (without the token, the email, or a full client id), so a
// GOOGLE_CLIENT_IDS rollout can be watched.
async function checkAudience(googleToken: string, clientIds: string[]) {
  let response: AxiosResponse;
  try {
    response = await axios.get(GOOGLE_TOKENINFO_URL, {
      params: { access_token: googleToken },
    });
  } catch (error: any) {
    console.warn(
      `Login : Google tokeninfo request failed: ${
        error?.response?.status ?? error?.code ?? "unknown error"
      }`,
    );
    throw error;
  }
  const { aud, azp } = response.data ?? {};

  if (
    ![aud, azp].some((id) => typeof id === "string" && clientIds.includes(id))
  ) {
    const audPrefix =
      typeof aud === "string" ? `${aud.slice(0, 12)}…` : "missing";
    console.warn(`Login : Google token audience mismatch (aud=${audPrefix})`);
    throw new Error("Google access token was issued to another client");
  }
}

function checkData(data: object, keys: string[]) {
  // Check if input is an object
  if (typeof data !== "object") throw new Error("Not a object");

  // Check if object have all required keys
  if (Object.keys(data).length !== keys.length) throw new Error("Invalid data");
  for (const key of keys) {
    if (!(key in data)) throw new Error("Invalid data");
  }

  return true;
}
