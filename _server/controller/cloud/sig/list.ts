import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { sigActivity } from "@module/SigActivity";
import { toPublicSig } from "@module/SigView";

const SigDB = new MongoDB.Sig();

/**
 * GET /sig/list: the non-archived SIGs, each with `color`, `defaultCover`,
 * `recruiting`, `memberCount`, `followerCount` and `latestPostAt` (API
 * contract v4 §6.5). The member counts and latest post times come from one
 * aggregation cached for 60 s; the SIG documents themselves are read on each
 * request, so edits, leader changes and follows show at once.
 */
export const listAll: RequestHandler = async (_, res) => {
  try {
    const [sigData, activity] = await Promise.all([
      SigDB.list({ removed: false }, { lean: true }),
      sigActivity(),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: sigData.map((sig) => toPublicSig(sig, activity)),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
