import { RequestHandler } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";
import EscapeRegExp from "@module/EscapeRegExp";
import TTLCache from "@module/TTLCache";
import { toPostListItems } from "./_listItems";

const PostDB = new MongoDB.Post();

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_TAG_LENGTH = 100;
const DEFAULT_TOP_LIMIT = 20;
const MAX_TOP_LIMIT = 100;
const TOP_CACHE_MS = 5 * 60 * 1000;

type TagCount = { tag: string; count: number };

// Every tag in use, most used first; GET /post/hashtags/top slices it.
const topCache = new TTLCache<TagCount[]>(TOP_CACHE_MS, 1);

/**
 * A stored or requested tag without the surrounding spaces and one leading
 * "#": stored tags may or may not carry the "#".
 */
export function normalizeTag(tag: string) {
  return tag.trim().replace(/^#/, "").trim();
}

/**
 * GET /post/list/hashtag/:tag?skip=&limit=
 *
 * Non-removed posts carrying the tag, newest first, with `total`. The tag is
 * matched case-insensitively and with or without a leading "#", on either
 * side. Same items as GET /post/list.
 */
export const listAllByHashtag: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const tag = normalizeTag(String(req.params.tag ?? ""));
    if (tag.length === 0 || tag.length > MAX_TAG_LENGTH)
      throw new CustomError(
        CustomStatus.INVALID_QUERY,
        new Error(`tag should be 1 to ${MAX_TAG_LENGTH} characters`),
      );

    CheckValidPaginationOption(req, MAX_LIST_LIMIT);
    const skip = req.query?.skip ? Number(req.query.skip) : 0;
    const limit = req.query?.limit
      ? Number(req.query.limit)
      : DEFAULT_LIST_LIMIT;

    // Same normalization as normalizeTag, applied to the stored tags.
    const filter = {
      removed: false,
      hashtag: {
        $regex: `^\\s*#?\\s*${EscapeRegExp(tag)}\\s*$`,
        $options: "i",
      },
    };

    const [posts, total] = await Promise.all([
      PostDB.list(filter, { skip, limit, sort: { createdAt: -1, _id: -1 } }),
      PostDB.count(filter),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await toPostListItems(posts),
      total,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

/**
 * GET /post/hashtags/top?limit=
 *
 * `[{ tag, count }]`: the tags of non-removed posts without "#", most used
 * first (count = number of posts). Tags that differ only in case are one
 * tag, shown in its most used spelling. Cached for 5 minutes.
 */
export const listTopHashtags: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    CheckValidPaginationOption(req, MAX_TOP_LIMIT);
    const limit = req.query?.limit
      ? Number(req.query.limit)
      : DEFAULT_TOP_LIMIT;

    const tags = await allTagCounts();

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: tags.slice(0, limit),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

/**
 * Every tag of the non-removed posts with its post count, most used first
 * (cached for 5 minutes). Also used by the unified GET /search.
 */
export function allTagCounts() {
  return topCache.getOrLoad("all", countTags);
}

async function countTags(): Promise<TagCount[]> {
  const posts = await PostDB.list(
    { removed: false, hashtag: { $exists: true, $ne: [] } },
    { projection: { hashtag: 1 } },
  );

  // Lower-cased tag -> number of posts, and how often each spelling is used.
  const counts = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();
  for (const post of posts) {
    if (!Array.isArray(post.hashtag)) continue;

    const seen = new Set<string>();
    for (const raw of post.hashtag) {
      if (typeof raw !== "string") continue;
      const tag = normalizeTag(raw);
      const key = tag.toLowerCase();
      if (tag === "" || seen.has(key)) continue;
      seen.add(key);

      const entry = counts.get(key) ?? { count: 0, spellings: new Map() };
      entry.count++;
      entry.spellings.set(tag, (entry.spellings.get(tag) ?? 0) + 1);
      counts.set(key, entry);
    }
  }

  return Array.from(counts.values())
    .map(({ count, spellings }) => ({
      tag: mostUsed(spellings),
      count,
    }))
    .sort((a, b) => b.count - a.count || compareText(a.tag, b.tag));
}

function mostUsed(spellings: Map<string, number>) {
  let best = "";
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (
      count > bestCount ||
      (count === bestCount && compareText(spelling, best) < 0)
    ) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

function compareText(a: string, b: string) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
