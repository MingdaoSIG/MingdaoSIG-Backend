import { ObjectId } from "mongoose";
import { v4 as uuid } from "uuid";

import { JoinRequest, JoinRequestWrite } from "@type/joinRequest";
import joinRequest from "@schema/joinRequest";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(
  id: string | ObjectId | null,
  dataToSave: JoinRequestWrite
) {
  try {
    const data = await joinRequest.findOne({ _id: id });
    const code = data ? 1 : 0;

    if (code) {
      return joinRequest.findOneAndUpdate({ _id: id }, dataToSave, {
        returnDocument: "after"
      }) as unknown as JoinRequest;
    }
    else {
      return (await joinRequest.create({
        ...dataToSave,
        confirmId: uuid()
      })) as unknown as JoinRequest;
    }
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_WRITING_JOIN_REQUEST_TO_DB,
      error
    );
  }
}

// Moves a pending request to accepted/rejected. Returns null when the request
// is no longer pending, so two confirmations cannot both win.
export async function confirmPending(
  id: string | ObjectId,
  state: "accepted" | "rejected"
) {
  try {
    return (await joinRequest.findOneAndUpdate(
      { _id: id, state: "pending", removed: false },
      { state },
      { returnDocument: "after" }
    )) as unknown as JoinRequest | null;
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_WRITING_JOIN_REQUEST_TO_DB,
      error
    );
  }
}

export async function markRemoved(id: string | ObjectId) {
  try {
    return (await joinRequest.findOneAndUpdate(
      { _id: id },
      { removed: true },
      { returnDocument: "after" }
    )) as unknown as JoinRequest | null;
  }
  catch (error: any) {
    throw new CustomError(
      CustomStatus.ERROR_WRITING_JOIN_REQUEST_TO_DB,
      error
    );
  }
}
