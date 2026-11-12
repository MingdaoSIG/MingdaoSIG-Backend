import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import post from "@schema/post";
import sig from "@schema/sig";
import joinRequest from "@schema/joinRequest";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { CachedPlainTextExcerpt } from "@module/PlainTextExcerpt";
import { feedbackByPost } from "@module/Feedback";
import { caller, sendError } from "@controller/cloud/admin/_shared";

const CommentDB = new MongoDB.Comment();
const AdminDB = new MongoDB.Admin();

type Role = "member" | "leader" | "moderator";

/**
 * The caller's SIGs (non-removed): memberships in `user.sig` order, then
 * SIGs they only lead or advise. `joinedAt` is the `updatedAt` of their
 * newest accepted join request to that SIG, or null.
 */
async function portfolioSigs(userId: string, memberOf: string[]) {
  const memberIds = Array.from(new Set(memberOf.map(String))).filter((id) =>
    isValidObjectId(id),
  );
  const sigs: any[] = await sig
    .find(
      {
        removed: false,
        $or: [
          { _id: { $in: memberIds } },
          { leader: userId },
          { moderator: userId },
        ],
      },
      { name: 1, leader: 1, moderator: 1 },
    )
    .sort({ _id: 1 })
    .lean();
  const sigIds = sigs.map((doc) => String(doc._id));

  const accepted: { _id: string; joinedAt: Date }[] =
    sigIds.length === 0
      ? []
      : await joinRequest.aggregate([
          {
            $match: {
              user: userId,
              sig: { $in: sigIds },
              state: "accepted",
              removed: false,
            },
          },
          { $group: { _id: "$sig", joinedAt: { $max: "$updatedAt" } } },
        ]);
  const joinedAt = new Map(accepted.map((row) => [row._id, row.joinedAt]));

  const position = (id: string) => {
    const index = memberIds.indexOf(id);
    return index === -1 ? memberIds.length : index;
  };
  return sigs
    .map((doc) => {
      const id = String(doc._id);
      const roles: Role[] = [];
      if (memberIds.includes(id)) roles.push("member");
      if (doc.leader?.includes(userId)) roles.push("leader");
      if (doc.moderator?.includes(userId)) roles.push("moderator");
      return {
        _id: id,
        name: doc.name ?? "",
        joinedAt: joinedAt.get(id) ?? null,
        roles,
      };
    })
    .sort((a, b) => position(a._id) - position(b._id));
}

// GET /user/me/portfolio (JWT): the caller's learning portfolio (學習歷程,
// API contract v4 §3.1). Every non-removed post, newest first, with its teacher
// feedback.
export const portfolio: RequestHandler = async (req, res) => {
  try {
    const me = caller(req);
    const userId = String(me._id);

    const posts: any[] = await post
      .find(
        { user: userId, removed: false },
        {
          title: 1,
          sig: 1,
          content: 1,
          likes: 1,
          views: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      )
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    const postIds = posts.map((doc) => String(doc._id));

    const [comments, feedback, sigNames, sigs] = await Promise.all([
      CommentDB.countByPost(postIds),
      feedbackByPost(postIds),
      AdminDB.sigsByIds(
        posts.map((doc) => doc.sig),
        { name: 1 },
      ),
      portfolioSigs(userId, me.sig ?? []),
    ]);
    const feedbackAuthors = await AdminDB.usersByIds(
      Array.from(feedback.values()).flatMap((list) =>
        list.map((entry) => entry.author),
      ),
      { name: 1 },
    );

    const totals = { posts: posts.length, likes: 0, comments: 0, views: 0 };
    const items = posts.map((doc) => {
      const id = String(doc._id);
      const likes = doc.likes ?? 0;
      const commentCount = comments[id] ?? 0;
      const views = doc.views ?? 0;
      totals.likes += likes;
      totals.comments += commentCount;
      totals.views += views;
      return {
        _id: id,
        title: doc.title ?? "",
        sig: {
          _id: String(doc.sig ?? ""),
          name: sigNames.get(String(doc.sig))?.name ?? "",
        },
        createdAt: doc.createdAt,
        likes,
        comments: commentCount,
        views,
        // Same cache key as the post list items.
        excerpt: CachedPlainTextExcerpt(
          `${id}:${new Date(doc.updatedAt ?? 0).getTime()}:${
            doc.content?.length ?? 0
          }`,
          doc.content,
        ),
        feedback: (feedback.get(id) ?? []).map((entry) => ({
          _id: String(entry._id),
          content: entry.content,
          author: {
            name: feedbackAuthors.get(String(entry.author))?.name ?? "",
          },
          createdAt: entry.createdAt,
        })),
      };
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        user: {
          name: me.name ?? "",
          customId: me.customId ?? "",
          class: me.class ?? "",
          identity: me.identity ?? "",
          avatar: me.avatar ?? "",
        },
        posts: items,
        sigs,
        totals,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
