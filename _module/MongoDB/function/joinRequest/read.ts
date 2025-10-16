import { ObjectId } from "mongoose";

import { JoinRequest } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import user from "../user";


export async function readById(id: string | ObjectId) {
  return await readData("_id", id);
}

export async function readByUserIdAndSigId(userId: string, sigId: string) {
  try {
    const data = await readDataByUserAndSig(userId, sigId);

    if (data) {
      return data;
    }
    else {
      throw new Error("JoinRequest not found");
    }
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error
    );
  }
}

export async function readByConfirmId(confirmId: string) {
  return await readData("confirmId", confirmId);
}

async function readDataByUserAndSig(userId: string, sigId: string) {
  try {
    const data = await joinRequest.findOne({
      user: userId,
      sig: sigId,
      removed: false
    });

    if (!data) {
      throw new Error("JoinRequest not found");
    }

    return data as unknown as JoinRequest;
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error
    );
  }
}

async function readData(key: string, value: any) {
  try {
    const data = await joinRequest.findOne({
      [key]: value,
      removed: false
    });

    if (!data) {
      throw new Error("JoinRequest not found");
    }

    return data as unknown as JoinRequest;
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_READING_JOIN_REQUEST_FROM_DB,
      error
    );
  }
}
