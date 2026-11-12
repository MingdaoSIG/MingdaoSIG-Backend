import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import TTLCache from "@module/TTLCache";
import { countOpenReports } from "@module/Report";
import { isAdmin } from "@module/Permission";
import { caller, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new TTLCache<Awaited<ReturnType<typeof loadOverview>>>(
  60 * 1000,
  1,
);

const sigItem = (sig: any) => ({
  _id: String(sig._id),
  name: sig.name ?? "",
  customId: sig.customId ?? "",
});

async function loadOverview() {
  const data = await AdminDB.overview(new Date(Date.now() - WEEK_MS));

  const authors = await AdminDB.usersByIds(
    data.recentPosts.map((post) => post.user),
    { name: 1, customId: 1 },
  );

  return {
    users: { total: data.usersTotal, last7d: data.usersLast7d },
    posts: { total: data.postsTotal, last7d: data.postsLast7d },
    comments: { total: data.commentsTotal, last7d: data.commentsLast7d },
    pendingJoinRequests: {
      total: data.pendingTotal,
      oldestCreatedAt: data.oldestPendingCreatedAt,
    },
    sigsWithoutLeader: data.sigsWithoutLeader.map(sigItem),
    sigsWithoutModerator: data.sigsWithoutModerator.map(sigItem),
    recentPosts: data.recentPosts.map((post) => {
      const author = authors.get(String(post.user));
      return {
        _id: String(post._id),
        title: post.title ?? "",
        sig: post.sig ?? "",
        user: {
          _id: post.user ?? "",
          name: author?.name ?? "",
          customId: author?.customId ?? "",
        },
        createdAt: post.createdAt ?? null,
      };
    }),
  };
}

// GET /admin/overview (admin, content moderator). Cached for 60 s, except
// `openReports`, which is counted on every call so the 檢舉 badge updates as
// soon as one is handled. Content moderators get only the posts, comments
// and open-report numbers (contract v4 §5.2).
export const overview: RequestHandler = async (req, res) => {
  try {
    const [data, openReports] = await Promise.all([
      cache.getOrLoad("overview", loadOverview),
      countOpenReports(),
    ]);
    const visible = isAdmin(caller(req))
      ? { ...data, openReports }
      : { posts: data.posts, comments: data.comments, openReports };
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: visible });
  } catch (error) {
    return sendError(res, error);
  }
};
