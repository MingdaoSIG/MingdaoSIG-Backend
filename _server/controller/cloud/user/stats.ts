import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { dailyViews, recentTaipeiDates } from "@module/PostViews";
import { callerId, fail, sendError } from "../admin/_shared";

const PostDB = new MongoDB.Post();
const CommentDB = new MongoDB.Comment();

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

// `days`: an integer from 1 to 365, default 30; 404/4012 otherwise.
function rangeDays(value: unknown) {
  if (value === undefined) return DEFAULT_DAYS;
  if (typeof value !== "string" || !/^\d+$/.test(value))
    fail(CustomStatus.INVALID_QUERY, "days is not a positive integer");
  const days = Number(value);
  if (days < 1 || days > MAX_DAYS)
    fail(CustomStatus.INVALID_QUERY, `days should be from 1 to ${MAX_DAYS}`);
  return days;
}

/**
 * GET /user/me/stats?days=30 (JWT): the caller's non-removed posts with
 * their lifetime views, likes and comments, the views per Asia/Taipei day
 * over the last `days` days (today included, oldest first, zero-filled) and
 * each post's views in that range. Posts are newest first.
 */
export const stats: RequestHandler = async (req, res) => {
  try {
    const days = rangeDays(req.query.days);
    const dates = recentTaipeiDates(days);

    const posts = await PostDB.list(
      { user: callerId(req), removed: false },
      {
        sort: { createdAt: -1, _id: -1 },
        projection: { title: 1, createdAt: 1, views: 1, likes: 1 },
      },
    );
    const postIds = posts.map((post) => String(post._id));

    const [comments, views] = await Promise.all([
      CommentDB.countByPost(postIds),
      dailyViews(postIds, dates[0], dates[dates.length - 1]),
    ]);

    const items = posts.map((post) => {
      const id = String(post._id);
      return {
        _id: id,
        title: post.title ?? "",
        createdAt: post.createdAt ?? null,
        views: post.views ?? 0,
        likes: post.likes ?? 0,
        comments: comments[id] ?? 0,
        viewsInRange: views.byPost.get(id) ?? 0,
      };
    });

    const sum = (key: "views" | "likes" | "comments") =>
      items.reduce((total, item) => total + item[key], 0);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        totals: {
          posts: items.length,
          views: sum("views"),
          likes: sum("likes"),
          comments: sum("comments"),
        },
        daily: dates.map((date) => ({
          date,
          views: views.byDate.get(date) ?? 0,
        })),
        posts: items,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
