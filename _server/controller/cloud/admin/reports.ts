import { RequestHandler } from "express";
import { SortOrder } from "mongoose";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import post from "@schema/post";
import comment from "@schema/comment";
import { recordAudit } from "@module/Audit";
import { notify } from "@module/Notify";
import {
  REPORT_TARGET_KINDS,
  RESOLUTION_MAX,
  ReportModel,
  ReportTargetKind,
} from "@module/Report";
import { boundedString, objectBody } from "../_body";
import { applyAction } from "./posts";
import { setCommentRemoved } from "./comments";
import {
  callerId,
  fail,
  pagination,
  pathId,
  queryEnum,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();

const STATUSES = ["open", "resolved", "dismissed", "all"] as const;
const ACTIONS = ["remove", "dismiss"] as const;
type ResolveAction = (typeof ACTIONS)[number];

const EXCERPT_LENGTH = 100;

const excerpt = (text: unknown) =>
  Array.from(String(text ?? ""))
    .slice(0, EXCERPT_LENGTH)
    .join("");

/** The reported posts and comments (removed ones included), by id. */
async function loadTargets(reports: any[]) {
  const idsOf = (kind: ReportTargetKind) =>
    reports
      .filter((report) => report.target?.kind === kind)
      .map((report) => String(report.target.id));

  const comments = new Map<string, any>();
  const commentIds = idsOf("comment");
  if (commentIds.length > 0) {
    const docs = await comment
      .find(
        { _id: { $in: commentIds } },
        { content: 1, user: 1, post: 1, removed: 1 },
      )
      .lean();
    for (const doc of docs) comments.set(String(doc._id), doc);
  }

  const posts = await AdminDB.postsByIds(idsOf("post"), {
    title: 1,
    user: 1,
    removed: 1,
  });
  return { posts, comments };
}

// GET /admin/reports?status&kind&skip&limit (admin). Open reports oldest
// first, every other status newest first.
export const listReports: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const status = queryEnum(req, "status", STATUSES, "open");
    const kind = queryEnum<ReportTargetKind | "">(
      req,
      "kind",
      REPORT_TARGET_KINDS,
      "",
    );

    const filter: Filter = {};
    if (status !== "all") filter.status = status;
    if (kind) filter["target.kind"] = kind;
    const sort: Record<string, SortOrder> =
      status === "open" ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };

    const [data, total] = await Promise.all([
      ReportModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ReportModel.countDocuments(filter),
    ]);

    const { posts, comments } = await loadTargets(data);
    const users = await AdminDB.usersByIds(
      [
        ...data.map((report: any) => report.reporter),
        ...data.map((report: any) => report.handledBy),
        ...Array.from(posts.values(), (doc) => doc.user),
        ...Array.from(comments.values(), (doc) => doc.user),
      ],
      { name: 1, customId: 1 },
    );
    const person = (id: unknown) => {
      const user = users.get(String(id ?? ""));
      return {
        _id: String(id ?? ""),
        name: user?.name ?? "",
        customId: user?.customId ?? "",
      };
    };

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((report: any) => {
        const id = String(report.target?.id ?? "");
        const isPost = report.target?.kind === "post";
        const doc = isPost ? posts.get(id) : comments.get(id);
        const author = person(doc?.user);
        return {
          _id: String(report._id),
          reporter: person(report.reporter),
          target: {
            kind: report.target?.kind,
            id,
            ...(isPost
              ? { title: doc?.title ?? "" }
              : { excerpt: excerpt(doc?.content) }),
            author: { _id: author._id, name: author.name },
            // A target that no longer exists counts as removed.
            removed: doc ? Boolean(doc.removed) : true,
            // The post to open: the post itself, or the comment's post.
            post: isPost ? id : String(doc?.post ?? ""),
          },
          reason: report.reason,
          note: report.note ?? "",
          status: report.status,
          handledBy: report.handledBy ?? null,
          handledByUser: report.handledBy ? person(report.handledBy) : null,
          resolution: report.resolution ?? "",
          createdAt: report.createdAt ?? null,
          updatedAt: report.updatedAt ?? null,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * Soft-removes the reported post or comment through the same code as
 * POST /admin/posts/:id/remove and /admin/comments/:id/remove (audit
 * `post.remove` / `comment.remove` when it changed anything).
 */
async function removeTarget(
  actor: string,
  kind: ReportTargetKind,
  id: string,
  reportId: string,
) {
  const meta = { report: reportId };
  if (kind === "post") await applyAction(actor, id, "remove", meta);
  else await setCommentRemoved(actor, id, true, meta);
}

/**
 * The reported content's label (post title or comment excerpt) and where the
 * reporter's notification links: the post if it is still visible, else "/".
 */
async function notificationTarget(kind: ReportTargetKind, id: string) {
  let label = "";
  let postId = "";
  if (kind === "post") {
    const doc: any = await post.findById(id, { title: 1 }).lean();
    label = doc?.title ?? "";
    postId = id;
  } else {
    const doc: any = await comment.findById(id, { content: 1, post: 1 }).lean();
    label = excerpt(doc?.content);
    postId = String(doc?.post ?? "");
  }

  const visible = postId
    ? await post.exists({ _id: postId, removed: false }).catch(() => null)
    : null;
  return { label, link: visible ? `/post/${postId}` : "/" };
}

/**
 * POST /admin/reports/:id/resolve { action: "remove"|"dismiss",
 * resolution? } (admin). `remove` soft-removes the target and marks the
 * reports resolved; `dismiss` marks them dismissed. Every open report on the
 * same target is closed and each reporter gets a `report_result`
 * notification. A report that is no longer open → 4031.
 */
export const resolveReport: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const body = objectBody(req, ["action", "resolution"], {
      required: ["action"],
    });
    if (!ACTIONS.includes(body.action as ResolveAction))
      fail(CustomStatus.INVALID_BODY, "action must be remove or dismiss");
    const action = body.action as ResolveAction;
    const resolution =
      body.resolution === undefined
        ? ""
        : boundedString(body.resolution, "resolution", RESOLUTION_MAX, {
            trim: true,
          });

    const actor = callerId(req);
    const status = action === "remove" ? "resolved" : "dismissed";
    const handled = { status, handledBy: actor, resolution };

    const report: any = await ReportModel.findById(id).lean();
    if (!report) fail(CustomStatus.NOT_FOUND, "Report not found");
    if (report.status !== "open")
      fail(CustomStatus.ALREADY_CONFIRMED, "Report already handled");

    // Claim the report first, so two admins cannot both handle it.
    const claimed: any = await ReportModel.findOneAndUpdate(
      { _id: id, status: "open" },
      { $set: handled },
      { returnDocument: "after" },
    ).lean();
    if (!claimed)
      fail(CustomStatus.ALREADY_CONFIRMED, "Report already handled");

    const kind = claimed.target.kind as ReportTargetKind;
    const targetId = String(claimed.target.id);

    if (action === "remove") {
      try {
        await removeTarget(actor, kind, targetId, id);
      } catch (error) {
        // Nothing was removed: reopen the report so it can be handled again.
        await ReportModel.updateOne(
          { _id: id, status },
          { $set: { status: "open", handledBy: null, resolution: "" } },
        ).catch(() => null);
        throw error;
      }
    }

    // Close every other open report on the same target.
    const others: any[] = await ReportModel.find(
      { "target.kind": kind, "target.id": targetId, status: "open" },
      { _id: 1 },
    ).lean();
    const closedOthers = await Promise.all(
      others.map((other) =>
        ReportModel.findOneAndUpdate(
          { _id: other._id, status: "open" },
          { $set: handled },
          { returnDocument: "after", projection: { reporter: 1 } },
        ).lean(),
      ),
    );
    const closed = [claimed, ...closedOthers.filter(Boolean)] as any[];

    const target = await notificationTarget(kind, targetId);

    await recordAudit({
      actor,
      action: action === "remove" ? "report.resolve" : "report.dismiss",
      target: { kind: "report", id, label: target.label },
      meta: {
        targetKind: kind,
        targetId,
        reports: closed.map((item) => String(item._id)),
      },
    });

    await notify(
      closed.map((item) => ({
        recipient: String(item.reporter),
        type: "report_result" as const,
        actor: null,
        target: {
          kind: "report" as const,
          id: String(item._id),
          label: target.label,
        },
        link: target.link,
        meta: { action, status, targetKind: kind },
      })),
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: id,
        status,
        handledBy: actor,
        resolution,
        closed: closed.length,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
