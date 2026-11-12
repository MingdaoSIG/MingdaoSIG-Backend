import { Request, RequestHandler } from "express";

import { Sig } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { canFollow, setFollowed } from "@module/SigFollow";
import {
  callerId,
  fail,
  pathId,
  sendError,
} from "@controller/cloud/admin/_shared";

const SigDB = new MongoDB.Sig();

// Follow SIGs (API contract v4 §6.1). Both routes are idempotent and return
// `{ followed, followers }`.

async function setFollow(req: Request, followed: boolean) {
  const sigId = pathId(req, "id");
  const sigData = (await SigDB.read({ id: sigId }).catch(
    () => null,
  )) as Sig | null;
  if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");
  // Unfollowing an archived SIG stays possible.
  if (followed && !canFollow(sigData))
    fail(CustomStatus.INVALID_SIG_ID, "Sig is archived");

  const followers = await setFollowed(sigId, callerId(req), followed);
  if (followers === null) fail(CustomStatus.NOT_FOUND, "Sig not found");
  return { followed, followers };
}

// POST /sig/:id/follow (JWT)
export const follow: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const data = await setFollow(req, true);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /sig/:id/follow (JWT)
export const unfollow: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const data = await setFollow(req, false);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};
