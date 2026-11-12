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
import { withActiveSuspension } from "@module/Suspension";
import post from "@schema/post";

const ProfileDB = new MongoDB.User();

/**
 * The public totals on a profile: the user's visible posts and the likes
 * they got (sum of `likes` over those posts). Zero on a failed count, so a
 * profile still loads.
 */
async function publicTotals(userId: string) {
  try {
    const [row] = await post.aggregate<{ posts: number; likes: number }>([
      { $match: { user: userId, removed: false } },
      {
        $group: {
          _id: null,
          posts: { $sum: 1 },
          likes: { $sum: { $ifNull: ["$likes", 0] } },
        },
      },
    ]);
    return { postCount: row?.posts ?? 0, likeCount: row?.likes ?? 0 };
  } catch (error) {
    console.error(
      "User : failed to count public totals:",
      error instanceof Error ? error.message : error,
    );
    return { postCount: 0, likeCount: 0 };
  }
}

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
      data: {
        ...toPublicUser(userData),
        ...(await publicTotals(String(userData._id))),
      },
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
        data: {
          ...toPublicUser(userData),
          ...(await publicTotals(String(userData._id))),
        },
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
// `notificationSettings` merged with the defaults, `followedSigs`,
// `onboardedAt` (contract v4 §6.1, §6.2) and `suspension` while it is in
// force (a banned caller gets 403/4041 from JWTverifier instead).
export const readMe: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: withActiveSuspension(
        await withOwnUserFields((req as ExtendedRequest).userData),
      ),
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
