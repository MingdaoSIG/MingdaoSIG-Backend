import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { findSigByCustomId } from "@module/CheckValidCustomId";
import { toSigResponse } from "@module/SigSettings";
import { withShowcase } from "./showcase";

const SigDB = new MongoDB.Sig();

export const readById: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId = req.params.sigId;

    if (!sigId || !isValidObjectId(sigId)) {
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );
    }

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) {
      throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: sigData._id,
      data: toSigResponse(await withShowcase(sigData)),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// GET /sig/@:customId: also by an old customId (`previousCustomIds`), then
// with `redirectTo: "<current customId>"` in data (contract v4 §3.7).
export const readByCustomId: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const customId: string = req.params.customId;

    const found = await findSigByCustomId(customId).catch(() => null);
    if (!found) {
      throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));
    }

    const data = toSigResponse(await withShowcase(found.sig));
    if (found.redirectTo) data.redirectTo = found.redirectTo;

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: found.sig._id,
      data,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
