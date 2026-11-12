import { Option } from "@type/database";
import { Post, PostFilter } from "@type/post";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

// Read only: returns plain objects (lean) with schema defaults filled in.
export default async function list(search: PostFilter, option?: Option) {
  try {
    const { skip, limit, sort } = option || {};

    const data = await post
      .find(search)
      .sort(sort || { createdAt: -1 })
      .skip(skip || 0)
      .limit(limit || 0)
      .lean();

    if (!data) {
      throw new Error("Post not found");
    }

    return data.map((item) => leanDefaults(post, item)) as unknown as Post[];
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
