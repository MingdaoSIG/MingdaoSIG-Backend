import posts_of_each_sigs from "./function/posts_of_each_sigs";
import posts from "./function/posts";
import users from "./function/users";
import posted_users from "./function/posted_users";
import likes from "./function/likes";
import top_posted_users from "./function/top_posted_users";
import top_posted_sigs from "./function/top_posted_sigs";
import top_liked_post from "./function/top_liked_posts";
import sig_users from "./function/users_of_each_sigs";


export class Analysis {
  async posts_of_each_sigs(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await posts_of_each_sigs(fromDate, toDate);
  }

  async posts(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await posts(fromDate, toDate);
  }

  async users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await users(fromDate, toDate);
  }

  async posted_users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await posted_users(fromDate, toDate);
  }

  async likes(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await likes(fromDate, toDate);
  }

  async top_posted_users(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined }
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await top_posted_users(fromDate, toDate, limit);
  }

  async top_posted_sigs(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined }
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await top_posted_sigs(fromDate, toDate, limit);
  }

  async top_liked_post(
    from: Date | undefined,
    to: Date,
    options?: { limit: number | undefined }
  ) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;
    const limit = options?.limit ?? 5;

    return await top_liked_post(fromDate, toDate, limit);
  }

  async sig_users(from: Date | undefined, to: Date) {
    const fromDate = new Date(from ?? 0) ?? 0;
    const toDate = new Date(to) ?? 0;

    return await sig_users(fromDate, toDate);
  }
}
