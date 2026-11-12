import { RequestHandler } from "express";

import user from "@schema/user";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { notify } from "@module/Notify";
import { parseImageId } from "@module/SigSettings";
import {
  CONTEXT_LIMITS,
  DESCRIPTION_MAX,
  IMAGES_MAX,
  ISSUE_CATEGORIES,
  IssueCategory,
  IssueContextKey,
  IssueReportModel,
  issueReportView,
  REPORTS_PER_HOUR,
  TITLE_MAX,
} from "@module/IssueReport";
import { boundedString, objectBody } from "../_body";
import {
  caller,
  callerId,
  fail,
  pagination,
  sendError,
} from "../admin/_shared";

const HOUR_MS = 60 * 60 * 1000;
const ADMIN_PERMISSION = 2;

/** `context`: an object with only the known keys, each a bounded string. */
function parseContext(value: unknown) {
  const context: Record<IssueContextKey, string> = {
    pageUrl: "",
    appVersion: "",
    userAgent: "",
    viewport: "",
    errorDigest: "",
  };
  if (value === undefined || value === null) return context;
  if (typeof value !== "object" || Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, "context must be an object");

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(key in CONTEXT_LIMITS))
      fail(CustomStatus.INVALID_BODY, `Unknown context field: ${key}`);
    const name = key as IssueContextKey;
    if (raw === undefined || raw === null) continue;
    context[name] = boundedString(
      raw,
      `context.${name}`,
      CONTEXT_LIMITS[name],
      {
        trim: true,
      },
    );
  }
  return context;
}

async function parseImages(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > IMAGES_MAX)
    fail(
      CustomStatus.INVALID_BODY,
      `images must be an array of at most ${IMAGES_MAX} image ids`,
    );
  const ids: string[] = [];
  for (const [index, id] of value.entries()) {
    const imageId = await parseImageId(id, `images[${index}]`);
    if (!ids.includes(imageId)) ids.push(imageId);
  }
  return ids;
}

/** Tells every admin about a new report (in-app, and push if they allow it). */
async function notifyAdmins(
  report: any,
  reporterId: string,
  reporterName: string,
) {
  const admins = await user
    .find({ permission: ADMIN_PERMISSION }, { _id: 1 })
    .lean<{ _id: unknown }[]>();
  await notify(
    admins.map((admin) => ({
      recipient: String(admin._id),
      type: "system" as const,
      actor: reporterId,
      target: {
        kind: "issue" as const,
        id: String(report._id),
        label: report.title,
      },
      link: `/admin/issue-reports?id=${report._id}`,
      meta: {
        title: "新的問題回報",
        message: `${reporterName || "使用者"}：${report.title}`,
      },
    })),
  );
}

/**
 * POST /issue-report { category, title, description, images?, context? }
 * (JWT). At most 5 per user per rolling hour (429/4290). Returns the report
 * as GET /issue-report/mine lists it.
 */
export const create: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(
      req,
      ["category", "title", "description", "images", "context"],
      { required: ["category", "title", "description"] },
    );
    if (!ISSUE_CATEGORIES.includes(body.category as IssueCategory))
      fail(
        CustomStatus.INVALID_BODY,
        `category must be one of: ${ISSUE_CATEGORIES.join(", ")}`,
      );
    const title = boundedString(body.title, "title", TITLE_MAX, {
      trim: true,
      min: 1,
    });
    const description = boundedString(
      body.description,
      "description",
      DESCRIPTION_MAX,
      { trim: true, min: 1 },
    );
    const context = parseContext(body.context);
    const images = await parseImages(body.images);

    const reporter = callerId(req);
    const recent = await IssueReportModel.countDocuments({
      reporter,
      createdAt: { $gt: new Date(Date.now() - HOUR_MS) },
    });
    if (recent >= REPORTS_PER_HOUR)
      fail(
        CustomStatus.TOO_MANY_REQUESTS,
        `At most ${REPORTS_PER_HOUR} reports per hour`,
      );

    const report = await IssueReportModel.create({
      reporter,
      category: body.category,
      title,
      description,
      images,
      context,
      status: "open",
    });

    // Never fails the request: notify logs its own errors.
    notifyAdmins(report, reporter, String(caller(req)?.name ?? "")).catch(
      (error) =>
        console.error(
          "IssueReport : failed to notify admins:",
          error instanceof Error ? error.message : error,
        ),
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: issueReportView(report.toObject()),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/** GET /issue-report/mine?skip&limit (JWT): the caller's reports, newest first. */
export const listMine: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const filter = { reporter: callerId(req) };
    const [data, total] = await Promise.all([
      IssueReportModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IssueReportModel.countDocuments(filter),
    ]);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map(issueReportView),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
