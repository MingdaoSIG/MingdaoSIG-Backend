import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import post from "@schema/post";
import comment from "@schema/comment";
import {
  NOTE_MAX,
  REPORT_REASONS,
  REPORT_TARGET_KINDS,
  ReportModel,
  ReportReason,
  ReportTargetKind,
} from "@module/Report";
import { callerId, fail, sendError } from "../admin/_shared";
import { boundedString, objectBody, storedId } from "../_body";

const DUPLICATE_KEY = 11000;

function reportTarget(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, "target must be { kind, id }");
  const { kind, id, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0)
    fail(CustomStatus.INVALID_BODY, "target must be { kind, id }");
  if (!REPORT_TARGET_KINDS.includes(kind as ReportTargetKind))
    fail(CustomStatus.INVALID_BODY, "target.kind must be post or comment");
  return { kind: kind as ReportTargetKind, id: storedId(id, "target.id") };
}

/**
 * The author of a visible target, or null when there is none: a post must
 * not be removed; a comment must not be removed and neither may its post.
 */
async function targetAuthor(kind: ReportTargetKind, id: string) {
  if (kind === "post") {
    const doc: any = await post
      .findOne({ _id: id, removed: false }, { user: 1 })
      .lean();
    return doc ? String(doc.user ?? "") : null;
  }

  const doc: any = await comment
    .findOne({ _id: id, removed: false }, { user: 1, post: 1 })
    .lean();
  if (!doc) return null;
  const parent = await post
    .exists({ _id: String(doc.post ?? ""), removed: false })
    .catch(() => null);
  return parent ? String(doc.user ?? "") : null;
}

/**
 * POST /report { target: { kind, id }, reason, note? } (JWT, write tier).
 * One open report per reporter and target (4029); your own content cannot
 * be reported (4001).
 */
export const create: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req, ["target", "reason", "note"], {
      required: ["target", "reason"],
    });
    const target = reportTarget(body.target);
    if (!REPORT_REASONS.includes(body.reason as ReportReason))
      fail(
        CustomStatus.INVALID_BODY,
        `reason must be one of: ${REPORT_REASONS.join(", ")}`,
      );
    const note =
      body.note === undefined
        ? ""
        : boundedString(body.note, "note", NOTE_MAX, { trim: true });

    const reporter = callerId(req);
    const author = await targetAuthor(target.kind, target.id);
    if (author === null)
      fail(CustomStatus.NOT_FOUND, `${target.kind} not found`);
    if (author === reporter)
      fail(CustomStatus.FORBIDDEN, "You cannot report your own content");

    const open = {
      reporter,
      "target.kind": target.kind,
      "target.id": target.id,
    };
    if (await ReportModel.exists({ ...open, status: "open" }))
      fail(CustomStatus.ALREADY_APPLIED, "You already reported this");

    let report: any;
    try {
      report = await ReportModel.create({
        reporter,
        target,
        reason: body.reason,
        note,
        status: "open",
      });
    } catch (error: any) {
      // A concurrent duplicate hit the unique index on open reports.
      if (error?.code === DUPLICATE_KEY)
        fail(CustomStatus.ALREADY_APPLIED, "You already reported this");
      throw error;
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: String(report._id),
        target: { kind: report.target.kind, id: report.target.id },
        reason: report.reason,
        note: report.note,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
