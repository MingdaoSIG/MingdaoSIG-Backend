import posts_of_each_sigs from "./function/posts_of_each_sigs";
import posts from "./function/posts";
import users from "./function/users";
import posted_users from "./function/posted_users";
import likes from "./function/likes";
import top_posted_users from "./function/top_posted_users";
import top_posted_sigs from "./function/top_posted_sigs";
import top_liked_post from "./function/top_liked_posts";
import sig_users from "./function/users_of_each_sigs";
import TTLCache from "@module/TTLCache";

const CACHE_TTL_MS = 5 * 60 * 1000;

// Shared by every Analysis instance. Results are cached for 5 minutes per
// function and date range, so the dashboard may be up to 5 minutes behind.
const cache = new TTLCache<any>(CACHE_TTL_MS);

function cached<T>(
  func: string,
  from: Date,
  to: Date,
  load: () => Promise<T>,
  extra = "",
): Promise<T> {
  // An invalid date used to fail in the Mongoose cast; keep failing (and
  // never cache) instead of sending NaN to MongoDB.
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return Promise.reject(new Error("Invalid date"));
  }
  const key = `${func}:${from.getTime()}:${to.getTime()}:${extra}`;
  return cache.getOrLoad(key, load) as Promise<T>;
}

export class Analysis {
  async posts_of_each_sigs(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("posts_of_each_sigs", fromDate, toDate, () =>
      posts_of_each_sigs(fromDate, toDate),
    );
  }

  async posts(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("posts", fromDate, toDate, () =>
      posts(fromDate, toDate),
    );
  }

  async users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("users", fromDate, toDate, () =>
      users(fromDate, toDate),
    );
  }

  async posted_users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("posted_users", fromDate, toDate, () =>
      posted_users(fromDate, toDate),
    );
  }

  async likes(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("likes", fromDate, toDate, () =>
      likes(fromDate, toDate),
    );
  }

  async top_posted_users(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined },
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await cached(
      "top_posted_users",
      fromDate,
      toDate,
      () => top_posted_users(fromDate, toDate, limit),
      String(limit),
    );
  }

  async top_posted_sigs(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined },
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await cached(
      "top_posted_sigs",
      fromDate,
      toDate,
      () => top_posted_sigs(fromDate, toDate, limit),
      String(limit),
    );
  }

  async top_liked_post(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined },
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await cached(
      "top_liked_post",
      fromDate,
      toDate,
      () => top_liked_post(fromDate, toDate, limit),
      String(limit),
    );
  }

  async sig_users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await cached("sig_users", fromDate, toDate, () =>
      sig_users(fromDate, toDate),
    );
  }
}
