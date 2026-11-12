import { RequestHandler } from "express";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import { notify } from "@module/Notify";
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  IssueCategory,
  IssueReportModel,
  issueReportView,
  IssueStatus,
  REPLY_MAX,
} from "@module/IssueReport";
import { boundedString, objectBody } from "../_body";
import {
  callerId,
  containsPattern,
  fail,
  pagination,
  pathId,
  queryEnum,
  queryText,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();

// "active" = open + in_progress, the default work queue.
const STATUS_FILTERS = [...ISSUE_STATUSES, "active", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const REPLY_EXCERPT = 60;

async function withPeople(reports: any[]) {
  const users = await AdminDB.usersByIds(
    [
      ...reports.map((report) => report.reporter),
      ...reports.map((report) => report.handledBy),
    ],
    { name: 1, customId: 1, email: 1, avatar: 1 },
  );
  const person = (id: unknown) => {
    const found = users.get(String(id ?? ""));
    return {
      _id: String(id ?? ""),
      name: found?.name ?? "",
      customId: found?.customId ?? "",
      email: found?.email ?? "",
      avatar: found?.avatar ?? "",
    };
  };
  return reports.map((report) => ({
    ...issueReportView(report),
    reporter: person(report.reporter),
    handledBy: report.handledBy ? person(report.handledBy) : null,
  }));
}

/**
 * GET /admin/issue-reports?status&category&q&skip&limit (admin).
 * `status` defaults to "active" (待處理 + 處理中); `q` matches the title and
 * the description. Newest first. `openCount` is the 待處理 total for the
 * sidebar badge.
 */
export const listIssueReports: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const status = queryEnum<StatusFilter>(
      req,
      "status",
      STATUS_FILTERS,
      "active",
    );
    const category = queryEnum<IssueCategory | "">(
      req,
      "category",
      ISSUE_CATEGORIES,
      "",
    );
    const q = queryText(req);

    const filter: Filter = {};
    if (status === "active") filter.status = { $in: ["open", "in_progress"] };
    else if (status !== "all") filter.status = status;
    if (category) filter.category = category;
    if (q)
      filter.$or = [
        { title: containsPattern(q) },
        { description: containsPattern(q) },
      ];

    const [data, total, openCount] = await Promise.all([
      IssueReportModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IssueReportModel.countDocuments(filter),
      IssueReportModel.countDocuments({ status: "open" }),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await withPeople(data),
      total,
      openCount,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/** GET /admin/issue-reports/:id (admin). */
export const readIssueReport: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const report = await IssueReportModel.findById(id).lean();
    if (!report) fail(CustomStatus.NOT_FOUND, "Issue report not found");
    const [data] = await withPeople([report]);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * POST /admin/issue-reports/:id { status?, reply? } (admin).
 *
 * A new or changed reply, or moving the report to 已解決 / 不處理, notifies
 * the reporter (`system`, linking to 個人專區 → 我的回報). Recorded in the
 * audit log as `issue.update`.
 */
export const updateIssueReport: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const body = objectBody(req, ["status", "reply"], { nonEmpty: true });
    if (
      body.status !== undefined &&
      !ISSUE_STATUSES.includes(body.status as IssueStatus)
    )
      fail(
        CustomStatus.INVALID_BODY,
        `status must be one of: ${ISSUE_STATUSES.join(", ")}`,
      );
    const reply =
      body.reply === undefined
        ? undefined
        : boundedString(body.reply, "reply", REPLY_MAX, { trim: true });

    const before: any = await IssueReportModel.findById(id).lean();
    if (!before) fail(CustomStatus.NOT_FOUND, "Issue report not found");

    const actor = callerId(req);
    const status = (body.status as IssueStatus | undefined) ?? before.status;
    const replyChanged = reply !== undefined && reply !== (before.reply ?? "");
    const statusChanged = status !== before.status;

    const update: Record<string, unknown> = { handledBy: actor };
    if (statusChanged) update.status = status;
    if (replyChanged) {
      update.reply = reply;
      update.repliedAt = reply ? new Date() : null;
    }

    const after: any = await IssueReportModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    ).lean();
    if (!after) fail(CustomStatus.NOT_FOUND, "Issue report not found");

    if (statusChanged || replyChanged) {
      await recordAudit({
        actor,
        action: "issue.update",
        target: { kind: "issue", id, label: after.title },
        meta: {
          ...(statusChanged ? { from: before.status, to: status } : {}),
          ...(replyChanged ? { replied: Boolean(reply) } : {}),
        },
      });
    }

    const closing =
      statusChanged && (status === "resolved" || status === "closed");
    if ((replyChanged && reply) || closing) {
      const text = after.reply
        ? Array.from(String(after.reply)).slice(0, REPLY_EXCERPT).join("")
        : "";
      await notify({
        recipient: String(after.reporter),
        type: "system",
        actor,
        target: { kind: "issue", id, label: after.title },
        link: `/me/reports?id=${id}`,
        meta: {
          title: "你的問題回報有更新",
          message: `「${after.title}」${ISSUE_STATUS_LABELS[after.status as IssueStatus]}${
            text ? `：${text}` : ""
          }`,
        },
      });
    }

    const [data] = await withPeople([after]);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};
