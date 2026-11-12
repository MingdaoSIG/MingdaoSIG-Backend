import { RequestHandler, Response } from "express";

import MongoDB from "@module/MongoDB";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { SendText } from "@module/SendMail";
import { notifyJoinResult } from "@module/NotifyEvents";
import { JoinRequest } from "@type/joinRequest";

const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();
const JoinRequestDB = new MongoDB.JoinRequest();

// GET /sig/confirm/:confirmId?accept=true|false (links in sent emails)
export const confirmJoinRequest: RequestHandler<
  Record<string, string>
> = async (req, res) => {
  const accept = req.query.accept;

  if (accept !== "true" && accept !== "false") {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: CustomStatus.INVALID_QUERY });
  }

  return await confirm(res, req.params.confirmId, accept === "true");
};

// POST /sig/confirm/:confirmId with {"accept": true|false}
export const confirmJoinRequestByBody: RequestHandler<
  Record<string, string>
> = async (req, res) => {
  const accept = req.body?.accept;

  if (typeof accept !== "boolean") {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: CustomStatus.INVALID_BODY });
  }

  return await confirm(res, req.params.confirmId, accept);
};

async function confirm(res: Response, confirmId: string, accept: boolean) {
  try {
    const oldJoinRequest = await JoinRequestDB.read({
      confirmId: confirmId,
    }).catch(() => null);
    if (!oldJoinRequest) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Request not found"),
      );
    }

    const savedData = await decideJoinRequest(oldJoinRequest, accept);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      state: savedData.state,
      data: savedData,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
}

/**
 * Accepts or rejects a join request: the email link (by confirmId) and the
 * admin panel (POST /admin/join-requests/:id/decision) both go through here.
 *
 * - A request that is no longer pending throws ALREADY_CONFIRMED (4031).
 * - Accepting needs the SIG to exist and not be removed (INVALID_SIG_ID).
 * - Accepting adds the SIG to the applicant's `sig` list.
 * - The applicant gets the result email and a `join_result` notification;
 *   a failed email or notification is logged only.
 *
 * Returns the updated request.
 */
export async function decideJoinRequest(
  oldJoinRequest: JoinRequest,
  accept: boolean,
) {
  if (oldJoinRequest.state !== "pending") {
    throw new CustomError(
      CustomStatus.ALREADY_CONFIRMED,
      new Error("Request already confirmed"),
    );
  }

  if (accept) {
    const sigData = await SigDB.read({ id: oldJoinRequest.sig }).catch(
      () => null,
    );
    if (!sigData || sigData.removed) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Sig removed"),
      );
    }
  }

  const savedData = await JoinRequestDB.confirmPending(
    oldJoinRequest._id,
    accept ? "accepted" : "rejected",
  );
  if (!savedData) {
    // Another confirmation won the race
    throw new CustomError(
      CustomStatus.ALREADY_CONFIRMED,
      new Error("Request already confirmed"),
    );
  }

  if (savedData.state === "accepted") {
    await UserDB.write(
      {
        // @ts-expect-error
        $addToSet: {
          sig: oldJoinRequest.sig,
        },
      },
      {
        id: oldJoinRequest.user,
      },
    );
  }

  notifyJoinResult({
    applicantId: String(oldJoinRequest.user),
    sigId: String(oldJoinRequest.sig),
    accepted: savedData.state === "accepted",
  });

  // The decision is saved; a failed notification must not report failure.
  await sendNotification(
    oldJoinRequest.user,
    oldJoinRequest.sig,
    savedData.state,
  ).catch(() => {
    console.warn("Join request confirmed, but the notification email failed");
  });

  return savedData;
}

async function sendNotification(userId: string, sigId: string, state: string) {
  const userData = await UserDB.read({ id: userId }).catch(() => null);
  if (!userData) {
    throw new CustomError(
      CustomStatus.FAILED_TO_SEND_EMAIL,
      new Error("Can't read user email"),
    );
  }

  const sigData = await SigDB.read({ id: sigId }).catch(() => null);
  if (!sigData) {
    throw new CustomError(
      CustomStatus.FAILED_TO_SEND_EMAIL,
      new Error("Can't read sig name"),
    );
  }

  const sigName = sigData.name;
  const userEmail = userData.email;
  await SendText(
    "SIG 申請結果通知",
    `您的${sigName} SIG 加入申請${
      state === "accepted" ? "已通過" : "被拒絕"
    }。`,
    [userEmail],
  );
}
