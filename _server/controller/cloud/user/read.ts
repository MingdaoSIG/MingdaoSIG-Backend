import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin } from "@module/Permission";


const ProfileDB = new MongoDB.User();

export const readById: RequestHandler = async (req, res) => {
  try {
    const id: string = req.params.id!;

    if (!id || !isValidObjectId(id)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );
    }

    const userData = await ProfileDB.read({ id }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found")
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: userData._id,
      data: userData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const readByCustomId: RequestHandler = async (req, res) => {
  try {
    const customId: string = req.params.id!;

    const userData = await ProfileDB.read({ customId }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found")
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: userData._id,
      data: userData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// GET /user/me: the caller's own full document (JWT required)
export const readMe: RequestHandler = async (req, res) => {
  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: (req as ExtendedRequest).userData
  });
};

// GET /user/:id/full: full document for that user themself or an admin
export const readFullById: RequestHandler = async (req, res) => {
  try {
    const id: string = req.params.id!;
    const caller = (req as ExtendedRequest).userData;

    if (String(caller?._id) !== id && !isAdmin(caller)) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ status: CustomStatus.FORBIDDEN });
    }

    if (!id || !isValidObjectId(id)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );
    }

    const userData = await ProfileDB.read({ id }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found")
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: userData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
