import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import TTLCache from "@module/TTLCache";

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();
const UserDB = new MongoDB.User();

const CACHE_MS = 10 * 60 * 1000;

type SitemapFeed = {
  posts: { _id: string; updatedAt: unknown }[];
  sigs: { customId: string }[];
  users: { customId: string; updatedAt: unknown }[];
};

const cache = new TTLCache<SitemapFeed>(CACHE_MS, 1);

/**
 * GET /post/sitemap: what the frontend's sitemap.xml lists. Every non-removed
 * post, every non-removed SIG, and the users with at least one non-removed
 * post (only public fields). SIGs and users without a customId have no page
 * and are left out. Cached for 10 minutes.
 */
export const sitemap: RequestHandler = async (_, res) => {
  try {
    const data = await cache.getOrLoad("all", loadFeed);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

async function loadFeed(): Promise<SitemapFeed> {
  const [posts, sigs] = await Promise.all([
    PostDB.list(
      { removed: false },
      {
        projection: { updatedAt: 1, user: 1 },
        sort: { updatedAt: -1, _id: -1 },
      },
    ),
    SigDB.list({ removed: false }, { lean: true, projection: { customId: 1 } }),
  ]);

  const authorIds = Array.from(
    new Set(posts.map((post) => String(post.user ?? ""))),
  ).filter((id) => isValidObjectId(id));
  const users =
    authorIds.length > 0
      ? await UserDB.list(
          { _id: { $in: authorIds } },
          { lean: true, projection: { customId: 1, updatedAt: 1 } },
        )
      : [];

  return {
    posts: posts.map((post) => ({
      _id: String(post._id),
      updatedAt: post.updatedAt ?? null,
    })),
    sigs: sigs
      .filter((sig) => Boolean(sig.customId))
      .map((sig) => ({ customId: String(sig.customId) })),
    users: users
      .filter((user) => Boolean(user.customId))
      .map((user) => ({
        customId: String(user.customId),
        updatedAt: (user as { updatedAt?: unknown }).updatedAt ?? null,
      })),
  };
}
