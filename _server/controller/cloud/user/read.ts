import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin } from "@module/Permission";
import toPublicUser from "@module/PublicUser";
import { withOwnUserFields } from "@module/Onboarding";
import { findUserByPreviousCustomId } from "@module/CheckValidCustomId";

const ProfileDB = new MongoDB.User();

export const readById: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const id: string = req.params.id;

    if (!id || !isValidObjectId(id)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );
    }

    const userData = await ProfileDB.read({ id }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found"),
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: userData._id,
      data: toPublicUser(userData),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// GET /user/@:id: also by an old customId (`previousCustomIds`), then with
// `redirectTo: "<current customId>"` in data (contract v4 §5.8).
export const readByCustomId: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const customId: string = req.params.id;

    const userData = await ProfileDB.read({ customId }).catch(() => null);
    if (userData) {
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        id: userData._id,
        data: toPublicUser(userData),
      });
    }

    const previous = await findUserByPreviousCustomId(customId).catch(
      () => null,
    );
    if (!previous) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found"),
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: previous.user._id,
      data: {
        ...toPublicUser(previous.user as any),
        redirectTo: previous.redirectTo,
      },
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// GET /user/me: the caller's own full document (JWT required), with
// `notificationSettings` merged with the defaults, `followedSigs` and
// `onboardedAt` (contract v4 §6.1, §6.2).
export const readMe: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await withOwnUserFields((req as ExtendedRequest).userData),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// GET /user/:id/full: full document for that user themself or an admin
export const readFullById: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const id: string = req.params.id;
    const caller = (req as ExtendedRequest).userData;

    if (String(caller?._id) !== id && !isAdmin(caller)) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ status: CustomStatus.FORBIDDEN });
    }

    if (!id || !isValidObjectId(id)) {
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );
    }

    const userData = await ProfileDB.read({ id }).catch(() => null);
    if (!userData) {
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("User not found"),
      );
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: userData,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
