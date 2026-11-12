import { isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { User } from "@type/user";
import { Sig } from "@type/sig";
import MongoDB from "@module/MongoDB";
import { CachedPlainTextExcerpt } from "@module/PlainTextExcerpt";

const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();
const CommentDB = new MongoDB.Comment();

/**
 * The post list item shape shared by GET /post/list and every other public
 * post list (SIG, user, likes, pinned, hashtag, search): the stored post with
 * the author's and the SIG's `_id` and `name`, the comment count, `views`
 * and a plain text `excerpt`. Keeps the order of `postData`.
 */
export async function toPostListItems(postData: Post[]) {
  const userIds = new Set<string>();
  const sigIds = new Set<string>();
  const postIds = new Set<string>();
  postData.forEach((post) => {
    userIds.add(post.user);
    sigIds.add(post.sig);
    postIds.add(String(post._id));
  });

  const [usersData, sigsData, commentNumberMap] = await Promise.all([
    UserDB.list(
      { _id: { $in: validIds(userIds) } },
      { lean: true, projection: { name: 1 } },
    ),
    SigDB.list(
      { _id: { $in: validIds(sigIds) } },
      { lean: true, projection: { name: 1 } },
    ),
    CommentDB.countByPost(Array.from(postIds)),
  ]);

  const usersDataMap: Record<string, User> = {};
  usersData.forEach((user) => {
    if (user._id) {
      usersDataMap[String(user._id)] = user;
    }
  });

  const sigsDataMap: Record<string, Sig> = {};
  sigsData.forEach((sig) => {
    if (sig._id) {
      sigsDataMap[String(sig._id)] = sig;
    }
  });

  return postData.map((post) => {
    const postId = String(post._id);
    return {
      ...post,
      user: {
        _id: usersDataMap[post.user]?._id,
        name: usersDataMap[post.user]?.name,
      },
      sig: {
        _id: sigsDataMap[post.sig]?._id,
        name: sigsDataMap[post.sig]?.name,
      },
      comments: commentNumberMap[postId] ?? 0,
      views: post.views ?? 0,
      // Plain text preview, so list views do not need the full content.
      excerpt: CachedPlainTextExcerpt(
        `${postId}:${new Date(post.updatedAt ?? 0).getTime()}:${
          post.content?.length ?? 0
        }`,
        post.content,
      ),
    };
  });
}

// A malformed id would make the whole $in query fail.
function validIds(ids: Set<string>) {
  return Array.from(ids).filter((id) => isValidObjectId(id));
}
