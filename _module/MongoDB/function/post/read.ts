import { ObjectId } from "mongoose";

import { Post } from "@type/post";
import { ReadOption } from "@type/database";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

export default async function read(id: string | ObjectId, option?: ReadOption) {
  try {
    const { lean, projection } = option || {};
    const query = post.findOne({ _id: id, removed: false }, projection);

    const data = lean
      ? await query
          .lean()
          .then((doc) => (doc && !projection ? leanDefaults(post, doc) : doc))
      : await query;

    if (!data) {
      throw new Error("Post not found");
    }

    return data as unknown as Post;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
