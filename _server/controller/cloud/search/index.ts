import { Request, RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { searchSigs, searchUsers } from "@module/Search";
import { fail, pagination, sendError } from "@controller/cloud/admin/_shared";
import { searchPosts, searchText } from "@controller/cloud/post/search";
import { allTagCounts, normalizeTag } from "@controller/cloud/post/hashtag";

// Unified search (API contract v4 §6.3). Paging through one type uses
// GET /post/search and GET /search/users.

const DEFAULT_SECTION_LIMIT = 5;
const MAX_SECTION_LIMIT = 20;

/** `limit` per section: an integer of at least 1, default 5, capped at 20. */
function sectionLimit(req: Request) {
  const value = req.query.limit;
  if (value === undefined) return DEFAULT_SECTION_LIMIT;
  if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1)
    fail(CustomStatus.INVALID_QUERY, "limit must be a positive integer");
  return Math.min(Number(value), MAX_SECTION_LIMIT);
}

/** Tags containing `q` (without a leading "#"), most used first. */
async function searchTags(q: string, limit: number) {
  const needle = normalizeTag(q).toLowerCase();
  if (needle === "") return [];
  const tags = await allTagCounts();
  return tags
    .filter((item) => item.tag.toLowerCase().includes(needle))
    .slice(0, limit);
}

/**
 * GET /search?q=&limit= (public): posts (ranked like GET /post/search, with
 * their total), SIGs, tags and users matching `q`, at most `limit` each.
 * The four sections run in parallel.
 */
export const searchAll: RequestHandler = async (req, res) => {
  try {
    const q = searchText(req.query.q);
    const limit = sectionLimit(req);

    const [posts, sigs, tags, users] = await Promise.all([
      searchPosts(q, { skip: 0, limit }),
      searchSigs(q, limit),
      searchTags(q, limit),
      searchUsers(q, { skip: 0, limit }),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        posts,
        sigs,
        tags,
        users: users.data.map((item) => ({
          _id: item._id,
          name: item.name ?? "",
          customId: item.customId ?? "",
          avatar: item.avatar ?? "",
        })),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * GET /search/users?q&skip&limit (public): every user matching `q` (see
 * searchUsers) as public fields, with `total`.
 */
export const searchUserList: RequestHandler = async (req, res) => {
  try {
    const q = searchText(req.query.q);
    const { skip, limit } = pagination(req);
    const { data, total } = await searchUsers(q, { skip, limit });

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data, total });
  } catch (error) {
    return sendError(res, error);
  }
};
