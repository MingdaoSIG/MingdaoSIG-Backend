import { PostFilter } from "@type/post";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

// Number of posts matching the filter.
export default async function count(search: PostFilter) {
  try {
    return await post.countDocuments(search);
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
