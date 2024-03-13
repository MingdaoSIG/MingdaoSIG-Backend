import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import { Comment } from "@type/comment";
import { User } from "@type/user";
import { Sort } from "@type/database";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";


const CommentDB = new MongoDB.Comment();
const PostDB = new MongoDB.Post();
const UserDB = new MongoDB.User();

export const listAllByPost: RequestHandler = async (req, res) => {
  try {
    const postId: string = req.params.postId!;
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    CheckValidPaginationOption(req);

    if (
      !isValidObjectId(postId) ||
            !(await PostDB.read({ id: postId }).catch(() => null))
    )
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id")
      );

    return await listByPost(
      res,
      { post: postId, reply: "" },
      skip ? Number(skip) : 0,
      limit ? Number(limit) : 0,
      { createAt: -1 }
    );
  }
  catch (error: any) {
    return res
      .status(
        error.statusCode
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR
      )
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

async function listByPost(
  res: Response,
  search: FilterQuery<Comment>,
  skip?: number,
  limit?: number,
  sort?: Sort
) {
  const commentData = await CommentDB.list(
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
  commentData?.forEach(comment => {
    userIds.add(comment.user);
  });

  const usersDataMap: Record<string, User> = {};
  const usersData = await UserDB.list({ _id: { $in: Array.from(userIds) } });
  usersData.forEach(user => {
    if (user._id) {
      usersDataMap[user._id] = user;
    }
  });

  const commentDataWithUser = commentData?.map(comment => {
    comment = JSON.parse(JSON.stringify(comment));
    return {
      ...comment,
      user: {
        customId: usersDataMap[comment.user]?.customId,
        avatar: usersDataMap[comment.user]?.avatar
      }
    };
  });

  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: commentDataWithUser
  });
}
