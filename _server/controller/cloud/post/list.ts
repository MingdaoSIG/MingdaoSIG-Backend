import { RequestHandler, Response } from "express";
import { QueryFilter, isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { Sort } from "@type/database";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";
import EscapeRegExp from "@module/EscapeRegExp";
import { toPostListItems } from "./_listItems";

const PostDB = new MongoDB.Post();
const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();

const sortMethods = {
  mostLikes: { likes: -1 },
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

// Page size of GET /post/list when the caller sends no `limit`.
const DEFAULT_LIST_LIMIT = 50;

// GET /post/list/admin
const ADMIN_DEFAULT_LIMIT = 50;
const ADMIN_MAX_LIMIT = 100;
const ADMIN_MAX_QUERY_LENGTH = 100;
const ADMIN_LIST_PROJECTION = {
  title: 1,
  sig: 1,
  user: 1,
  createdAt: 1,
  pinned: 1,
  likes: 1,
} as const;

export const listAll: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const skip = req.query?.skip;
    const limit = req.query?.limit;
    const sort = req.query?.sort;

    CheckValidPaginationOption(req);

    const sortMethod = sort
      ? sortMethods[String(sort) as keyof typeof sortMethods] ||
        sortMethods.mostLikes
      : sortMethods.mostLikes;

    return await listPostBy(
      res,
      { pinned: false },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : DEFAULT_LIST_LIMIT,
      sortMethod,
    );
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllBySig: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const sigId: string = req.params.id;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData)
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id"),
      );

    return await listPostBy(
      res,
      { sig: sigId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0,
    );
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByUser: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const userId: string = req.params.id;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(userId))
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );

    const haveUser = await UserDB.read({ id: userId }).catch(() => null);
    if (!haveUser)
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );

    return await listPostBy(
      res,
      { user: userId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0,
    );
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByUserLike: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const userId: string = req.params.id;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(userId))
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );

    const haveUser = await UserDB.read({ id: userId }).catch(() => null);
    if (!haveUser)
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id"),
      );

    return await listPostBy(
      res,
      { like: userId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0,
    );
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByPinned: RequestHandler<Record<string, string>> = async (
  _,
  res,
) => {
  try {
    return await listPostBy(res, { pinned: true });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// Admin post list: newest first, only the fields the table shows, and the
// total for the same filter. Mounted behind JWTverifier and adminOnly.
export const listForAdmin: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req, ADMIN_MAX_LIMIT);
    const q = adminTitleQuery(req.query?.q);

    const filter: QueryFilter<Post> = { removed: false };
    if (q) filter.title = { $regex: EscapeRegExp(q), $options: "i" };

    const [postData, total] = await Promise.all([
      PostDB.list(filter, {
        skip: skip ? Number(skip) : 0,
        limit: limit ? Number(limit) : ADMIN_DEFAULT_LIMIT,
        sort: { createdAt: -1, _id: -1 },
        projection: ADMIN_LIST_PROJECTION,
      }),
      PostDB.count(filter),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: postData.map((post) => ({
        _id: post._id,
        title: post.title,
        sig: post.sig,
        user: post.user,
        createdAt: post.createdAt,
        pinned: post.pinned ?? false,
        likes: post.likes ?? 0,
      })),
      total,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// Optional `q` (title search): a string of at most 100 characters once
// trimmed. An empty value means no search.
function adminTitleQuery(value: unknown) {
  if (value === undefined) return "";

  if (typeof value !== "string")
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error("q is not a string"),
    );

  const q = value.trim();
  if (q.length > ADMIN_MAX_QUERY_LENGTH)
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error(`q is longer than ${ADMIN_MAX_QUERY_LENGTH} characters`),
    );

  return q;
}

async function listPostBy(
  res: Response,
  search: QueryFilter<Post>,
  skip?: number,
  limit?: number,
  sort?: Sort,
) {
  const postData = await PostDB.list(
    {
      ...search,
      removed: false,
    },
    {
      skip: skip || 0,
      limit: limit || 0,
      sort: sort || { createdAt: -1 },
    },
  );

  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: await toPostListItems(postData),
  });
}

async function listAllByCreateTimeRange(res: Response, start: Date, end: Date) {
  try {
    const postData = await PostDB.list({
      createdAt: { $gte: start, $lte: end },
      removed: false,
    });
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: postData,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
}

export const listAllByTimeRange: RequestHandler<
  Record<string, string>
> = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Start and end time are required"),
      );
    }

    const startTime = new Date(String(start));
    const endTime = new Date(String(end));

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Invalid time format"),
      );
    }

    if (startTime > endTime) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Start time must be before end time"),
      );
    }

    //change time to MongoDB time format
    startTime.setUTCHours(0, 0, 0, 0);
    endTime.setUTCHours(23, 59, 59, 999);

    return await listAllByCreateTimeRange(res, startTime, endTime);
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
