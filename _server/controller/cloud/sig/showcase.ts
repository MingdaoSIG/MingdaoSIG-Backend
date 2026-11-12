import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { toPostListItems } from "@controller/cloud/post/_listItems";

// SIG showcase (精選成果, API contract v4 §3.4): `featuredPosts`, set through
// POST /sig/:id by the SIG's managers or an admin, resolved by the SIG reads.

export const FEATURED_POSTS_MAX = 6;

function invalid(message: string): never {
  throw new CustomError(CustomStatus.INVALID_BODY, new Error(message));
}

/**
 * `featuredPosts` for POST /sig/:id: up to 6 distinct ids, each of a
 * non-removed post of this SIG (order kept); anything else is 4011.
 */
export async function parseFeaturedPosts(value: unknown, sigId: string) {
  if (!Array.isArray(value) || value.length > FEATURED_POSTS_MAX)
    invalid(`featuredPosts must be an array of at most ${FEATURED_POSTS_MAX}`);
  if (!value.every((id) => typeof id === "string" && isValidObjectId(id)))
    invalid("featuredPosts must hold post ids");
  const ids = value as string[];
  if (new Set(ids).size !== ids.length) invalid("featuredPosts has duplicates");
  if (ids.length === 0) return ids;

  const found = await post.countDocuments({
    _id: { $in: ids },
    sig: sigId,
    removed: false,
  });
  if (found !== ids.length)
    invalid("featuredPosts must be non-removed posts of this sig");
  return ids;
}

/**
 * The featured posts as list items, in the stored order. Posts removed or
 * moved to another SIG since they were picked are left out.
 */
export async function resolveFeaturedPosts(ids: unknown, sigId: string) {
  const list = Array.isArray(ids)
    ? ids.map(String).filter((id) => isValidObjectId(id))
    : [];
  if (list.length === 0) return [];

  const docs = (await post
    .find({ _id: { $in: list }, sig: sigId, removed: false })
    .lean()) as unknown as Post[];
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const ordered = list
    .map((id) => byId.get(id))
    .filter((doc): doc is Post => Boolean(doc));

  const items = await toPostListItems(ordered);
  return items.map((item: any) => ({
    _id: item._id,
    title: item.title ?? "",
    cover: item.cover ?? "",
    excerpt: item.excerpt,
    createdAt: item.createdAt,
    likes: item.likes ?? 0,
    views: item.views ?? 0,
    comments: item.comments ?? 0,
    user: item.user,
    sig: item.sig,
  }));
}

/**
 * A SIG document as GET /sig/:id and /sig/@:customId return it, with
 * `featuredPosts` resolved to list items (always present, [] when unset). A
 * failed lookup of the showcase gives [] rather than failing the read.
 */
export async function withShowcase(sigData: any) {
  const data =
    typeof sigData?.toJSON === "function" ? sigData.toJSON() : { ...sigData };
  // Never the Discord webhook (§3.6), even if a query selected it.
  delete data.discordWebhook;
  data.featuredPosts = await resolveFeaturedPosts(
    data.featuredPosts,
    String(data._id),
  ).catch((error) => {
    console.error(
      `Sig : failed to resolve featured posts of ${String(data._id)}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  });
  return data;
}
