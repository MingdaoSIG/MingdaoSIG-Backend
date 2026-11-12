import { ListOption } from "@type/database";
import { Post, PostFilter } from "@type/post";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

// Read only: returns plain objects (lean). Schema defaults are filled in,
// except with a projection (a partial result).
export default async function list(search: PostFilter, option?: ListOption) {
  try {
    const { skip, limit, sort, projection } = option || {};

    const data = await post
      .find(search, projection)
      .sort(sort || { createdAt: -1 })
      .skip(skip || 0)
      .limit(limit || 0)
      .lean();

    if (!data) {
      throw new Error("Post not found");
    }

    const items = projection
      ? data
      : data.map((item) => leanDefaults(post, item));
    return items as unknown as Post[];
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
