import { RequestHandler } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";
import EscapeRegExp from "@module/EscapeRegExp";
import { toPostListItems } from "./_listItems";

const PostDB = new MongoDB.Post();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 100;

/**
 * GET /post/search?q=&skip=&limit=
 *
 * Case-insensitive literal substring search over the title, the hashtags and
 * the content of non-removed posts. Title matches first, then hashtag, then
 * content; newest first within each. Same items as GET /post/list, plus
 * `total`.
 */
export const search: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const q = searchText(req.query?.q);
    CheckValidPaginationOption(req, MAX_LIMIT);
    const skip = req.query?.skip ? Number(req.query.skip) : 0;
    const limit = req.query?.limit ? Number(req.query.limit) : DEFAULT_LIMIT;

    const { data, total } = await searchPosts(q, { skip, limit });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data,
      total,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

/**
 * One page of the ranked post search for `q` (taken literally) as list
 * items, with the total. Also used by the unified GET /search.
 */
export async function searchPosts(
  q: string,
  option: { skip: number; limit: number },
) {
  const { ids, total } = await PostDB.search(EscapeRegExp(q), option);

  const posts =
    ids.length > 0
      ? await PostDB.list({ _id: { $in: ids }, removed: false })
      : [];
  const byId = new Map(posts.map((post) => [String(post._id), post]));
  const ranked = ids.flatMap((id) => {
    const post = byId.get(id);
    return post ? [post] : [];
  });

  return { data: await toPostListItems(ranked), total };
}

// Required `q`: 1 to 100 characters once trimmed.
export function searchText(value: unknown) {
  if (typeof value !== "string")
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error("q is required"),
    );

  const q = value.trim();
  if (q.length === 0 || q.length > MAX_QUERY_LENGTH)
    throw new CustomError(
      CustomStatus.INVALID_QUERY,
      new Error(`q should be 1 to ${MAX_QUERY_LENGTH} characters`),
    );

  return q;
}
