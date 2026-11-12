import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import {
  addBookmark,
  bookmarkedPostIds,
  removeBookmark,
} from "@module/Bookmark";
import {
  callerId,
  fail,
  pagination,
  pathId,
  sendError,
} from "../admin/_shared";
import { toPostListItems } from "./_listItems";

const PostDB = new MongoDB.Post();

// POST /post/:id/bookmark (JWT). Idempotent.
export const bookmark: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const post = await PostDB.read(
      { id },
      { lean: true, projection: { _id: 1 } },
    ).catch(() => null);
    if (!post) fail(CustomStatus.NOT_FOUND, "Post not found");

    const postId = String(post._id);
    await addBookmark(callerId(req), postId);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { post: postId, bookmarked: true },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /post/:id/bookmark (JWT). Idempotent; works for removed posts too.
export const unbookmark: RequestHandler = async (req, res) => {
  try {
    const postId = pathId(req).toLowerCase();
    await removeBookmark(callerId(req), postId);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { post: postId, bookmarked: false },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * GET /user/me/bookmarks?skip&limit (JWT): the bookmarked posts that are not
 * removed, as post list items, newest bookmark first, with `total`.
 */
export const listBookmarks: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);

    const ids = await bookmarkedPostIds(callerId(req));
    const visible = ids.length
      ? await PostDB.list(
          { _id: { $in: ids }, removed: false },
          { projection: { _id: 1 } },
        )
      : [];
    const visibleIds = new Set(visible.map((post) => String(post._id)));
    const ordered = ids.filter((id) => visibleIds.has(id));
    const pageIds = ordered.slice(skip, skip + limit);

    const posts = pageIds.length
      ? await PostDB.list({ _id: { $in: pageIds }, removed: false })
      : [];
    const byId = new Map(posts.map((post) => [String(post._id), post]));
    const page = pageIds.flatMap((id) => {
      const post = byId.get(id);
      return post ? [post] : [];
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await toPostListItems(page),
      total: ordered.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /user/me/bookmarks/ids (JWT): every bookmarked post id, newest first.
export const listBookmarkIds: RequestHandler = async (req, res) => {
  try {
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await bookmarkedPostIds(callerId(req)),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
