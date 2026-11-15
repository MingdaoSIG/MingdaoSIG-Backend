import post from "@schema/post";
import comment from "@schema/comment";
import TTLCache from "@module/TTLCache";

/**
 * The home page's 熱門 order (owner request 2026-11-15): engagement that
 * decays with age, in the style of Hacker News / Reddit "hot".
 *
 *   engagement = 3 × likes + 4 × comments + 0.5 × log2(1 + views)
 *   hot        = engagement / (age in days + 2) ^ 1.5
 *
 * - Comments weigh the most (a conversation), then likes; views count on a
 *   log scale so a post that is only opened a lot cannot flood the list.
 * - There is no base score: a post with no likes, comments or views scores
 *   0 and sits at the end (newest first), so 熱門 never turns into 最新. A
 *   new post climbs as soon as people react; the +2 days and the 1.5
 *   gravity let a post with real engagement stay up for a while before
 *   older ones sink.
 * - Every visible (non-removed, non-pinned) post is scored, so the list can
 *   be paged to the end. The order is cached for 5 minutes.
 *
 * The 熱門貼文 card is NOT this: it stays the all-time most liked posts
 * (GET /post/list?sort=mostLikes).
 */

export const HOT_WEIGHTS = {
  like: 3,
  comment: 4,
  view: 0.5,
  gravity: 1.5,
  offsetDays: 2,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new TTLCache<string[]>(5 * 60 * 1000, 1);

export function hotScore(
  {
    likes,
    comments,
    views,
    createdAt,
  }: { likes: number; comments: number; views: number; createdAt: Date },
  now = Date.now(),
) {
  const engagement =
    HOT_WEIGHTS.like * Math.max(0, likes) +
    HOT_WEIGHTS.comment * Math.max(0, comments) +
    HOT_WEIGHTS.view * Math.log2(1 + Math.max(0, views));
  const ageDays = Math.max(0, (now - createdAt.getTime()) / DAY_MS);
  return engagement / (ageDays + HOT_WEIGHTS.offsetDays) ** HOT_WEIGHTS.gravity;
}

async function computeOrder(): Promise<string[]> {
  const [posts, counts] = await Promise.all([
    post
      .find(
        { removed: false, pinned: false },
        { likes: 1, views: 1, createdAt: 1 },
      )
      .lean<
        { _id: unknown; likes?: number; views?: number; createdAt?: Date }[]
      >(),
    comment.aggregate<{ _id: string; n: number }>([
      { $match: { removed: false } },
      { $group: { _id: "$post", n: { $sum: 1 } } },
    ]),
  ]);
  const commentsByPost = new Map(counts.map((c) => [String(c._id), c.n]));
  const now = Date.now();

  return posts
    .map((doc) => {
      const id = String(doc._id);
      const createdAt =
        doc.createdAt instanceof Date
          ? doc.createdAt
          : new Date(Number.parseInt(id.slice(0, 8), 16) * 1000);
      return {
        id,
        createdAt,
        score: hotScore(
          {
            likes: doc.likes ?? 0,
            comments: commentsByPost.get(id) ?? 0,
            views: doc.views ?? 0,
            createdAt,
          },
          now,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .map((entry) => entry.id);
}

/** Post ids in 熱門 order (cached for 5 minutes). */
export function hotPostIds() {
  return cache.getOrLoad("all", computeOrder);
}
