import { Option } from "@type/database";
import list from "./list";

// Filter value for `reply` that selects top-level comments. New comments
// store "", very old ones may have no `reply` at all.
export const TOP_LEVEL_REPLY = { $in: ["", null] };

/** A post's top-level comments that are not removed, newest first. */
export async function listTopLevel(
  postId: string,
  option?: Pick<Option, "skip" | "limit">,
) {
  return await list(
    { post: postId, removed: false, reply: TOP_LEVEL_REPLY },
    { ...option, sort: { createdAt: -1, _id: -1 } },
  );
}

/** The non-removed replies to the given comments of a post, oldest first. */
export async function listReplies(postId: string, parentIds: string[]) {
  if (parentIds.length === 0) return [];
  return await list(
    { post: postId, removed: false, reply: { $in: parentIds } },
    { sort: { createdAt: 1, _id: 1 } },
  );
}
