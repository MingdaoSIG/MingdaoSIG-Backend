import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordView } from "@module/PostViews";
import { seriesNavigation } from "@module/Series";

const PostDB = new MongoDB.Post();

/**
 * GET /post/:id. Counts a view (at most once per viewer per 6 h, see
 * @module/PostViews) and adds `views` and `series` (every series that
 * contains the post, with its place and the neighbours).
 */
export const read: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const id: string = req.params.id;

    if (!isValidObjectId(id))
      throw new CustomError(
        CustomStatus.INVALID_POST_ID,
        new Error("Invalid post id"),
      );

    const postData = await PostDB.read({ id }, { lean: true }).catch(
      () => null,
    );
    if (!postData)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Post not found"),
      );

    const postId = String(postData._id);
    const [counted, series] = await Promise.all([
      recordView(postId, req),
      seriesNavigation(postId).catch((error) => {
        console.error(
          `Post : failed to load the series of post ${postId}:`,
          error instanceof Error ? error.message : error,
        );
        return [];
      }),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: postData._id,
      data: {
        ...postData,
        views: (postData.views ?? 0) + (counted ? 1 : 0),
        series,
      },
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
