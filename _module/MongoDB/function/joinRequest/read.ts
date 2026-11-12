import { ObjectId } from "mongoose";

import { JoinRequest } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

export async function readById(id: string | ObjectId) {
  return await readData("_id", id);
}

export async function readByUserIdAndSigId(userId: string, sigId: string) {
  const data = await readLatestByUserIdAndSigId(userId, sigId);

  if (!data) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      new Error("JoinRequest not found"),
    );
  }

  return data;
}

/**
 * The user's newest request to a SIG that was not removed, or null when they
 * have none. A user can apply again after a rejection, so one user may hold
 * several requests to a SIG; the newest one is their current state. Throws
 * only when the database cannot be read.
 */
export async function readLatestByUserIdAndSigId(
  userId: string,
  sigId: string,
) {
  try {
    const data = await joinRequest
      .findOne({
        user: userId,
        sig: sigId,
        removed: false,
      })
      .sort({ createdAt: -1, _id: -1 });

    return data as unknown as JoinRequest | null;
  } catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error,
    );
  }
}

export async function readByConfirmId(confirmId: string) {
  return await readData("confirmId", confirmId);
}

async function readData(key: string, value: any) {
  try {
    const data = await joinRequest.findOne({
      [key]: value,
      removed: false,
    });

    if (!data) {
      throw new Error("JoinRequest not found");
    }

    return data as unknown as JoinRequest;
  } catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error,
    );
  }
}
