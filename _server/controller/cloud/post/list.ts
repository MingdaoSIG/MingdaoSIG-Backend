import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { User } from "@type/user";
import { Sig } from "@type/sig";
import { Sort } from "@type/database";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";


const PostDB = new MongoDB.Post();
const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();
const CommentDB = new MongoDB.Comment();

const sortMethods = {
  mostLikes: { likes: -1 },
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 }
};

export const listAll: RequestHandler = async (req, res) => {
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
      limit ? Number(limit) : 0,
      sortMethod
    );
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllBySig: RequestHandler = async (req, res) => {
  try {
    const sigId: string = req.params.id!;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(sigId))
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData)
      throw new CustomError(
        CustomStatus.INVALID_SIG_ID,
        new Error("Invalid sig id")
      );

    return await listPostBy(
      res,
      { sig: sigId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0
    );
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByUser: RequestHandler = async (req, res) => {
  try {
    const userId: string = req.params.id!;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(userId))
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );

    const haveUser = await UserDB.read({ id: userId }).catch(() => null);
    if (!haveUser)
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );

    return await listPostBy(
      res,
      { user: userId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0
    );
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByUserLike: RequestHandler = async (req, res) => {
  try {
    const userId: string = req.params.id!;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (!isValidObjectId(userId))
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );

    const haveUser = await UserDB.read({ id: userId }).catch(() => null);
    if (!haveUser)
      throw new CustomError(
        CustomStatus.INVALID_USER_ID,
        new Error("Invalid user id")
      );

    return await listPostBy(
      res,
      { like: userId },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0
    );
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const listAllByPinned: RequestHandler = async (_, res) => {
  try {
    return await listPostBy(res, { pinned: true });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

async function listPostBy(
  res: Response,
  search: FilterQuery<Post>,
  skip?: number,
  limit?: number,
  sort?: Sort
) {
  const postData = await PostDB.list(
    {
      ...search,
      removed: false
    },
    {
      skip: skip || 0,
      limit: limit || 0,
      sort: sort || { createdAt: -1 }
    }
  );

  const userIds = new Set<string>();
  postData?.forEach(post => {
    userIds.add(post.user);
  });
  const usersDataMap: Record<string, User> = {};
  const usersData = await UserDB.list({ _id: { $in: Array.from(userIds) } });
  usersData.forEach(user => {
    if (user._id) {
      usersDataMap[user._id] = user;
    }
  });

  const sigIds = new Set<string>();
  postData?.forEach(post => {
    sigIds.add(post.sig);
  });
  const sigsDataMap: Record<string, Sig> = {};
  const sigsData = await SigDB.list({
    _id: { $in: Array.from(sigIds) }
  });
  sigsData.forEach(sig => {
    if (sig._id) {
      sigsDataMap[sig._id] = sig;
    }
  });

  const postIds = new Set<string>();
  postData?.forEach(post => {
    postIds.add(post._id!);
  });
  const commentNumberMap: Record<string, number> = {};
  const commentData = await CommentDB.list({
    post: { $in: Array.from(postIds) },
    removed: false
  });
  commentData.forEach(comment => {
    if (commentNumberMap[comment.post]) {
      commentNumberMap[comment.post]++;
    }
    else {
      commentNumberMap[comment.post] = 1;
    }
  });

  const fullPostData = postData?.map(post => {
    post = JSON.parse(JSON.stringify(post));
    return {
      ...post,
      user: {
        _id: usersDataMap[post.user]?._id,
        name: usersDataMap[post.user]?.name
      },
      sig: {
        _id: sigsDataMap[post.sig]?._id,
        name: sigsDataMap[post.sig]?.name
      },
      comments: commentNumberMap[post._id!] ?? 0
    };
  });

  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: fullPostData
  });
}

async function listAllByCreateTimeRange(
  res: Response, start: Date, end: Date
) {
  try {
    const postData = await PostDB.list({
      createdAt: { $gte: start, $lte: end },
      removed: false
    });
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: postData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
}

export const listAllByTimeRange: RequestHandler = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Start and end time are required")
      );
    }

    const startTime = new Date(String(start));
    const endTime = new Date(String(end));

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Invalid time format")
      );
    }

    if (startTime > endTime) {
      throw new CustomError(
        CustomStatus.INVALID_TIME_RANGE,
        new Error("Start time must be before end time")
      );
    }

    //change time to MongoDB time format
    startTime.setUTCHours(0, 0, 0, 0);
    endTime.setUTCHours(23, 59, 59, 999);

    return await listAllByCreateTimeRange(res, startTime, endTime);
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
}