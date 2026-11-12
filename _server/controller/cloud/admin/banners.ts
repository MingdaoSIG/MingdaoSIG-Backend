import { RequestHandler, Response } from "express";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import {
  BANNER_LEVELS,
  BANNER_MESSAGE_MAX,
  BannerLevel,
  SiteBannerModel,
  clearBannerCache,
  isLive,
} from "@module/SiteBanner";
import { boundedString, dateValue, linkValue, objectBody } from "../_body";
import {
  callerId,
  fail,
  pagination,
  pathId,
  queryEnum,
  sendError,
} from "./_shared";

// Site banners (公告橫幅, contract v4 §5.4), admin only. Every change is
// audited as banner.update and shows on GET /site/banner at once.

const AdminDB = new MongoDB.Admin();

const FIELDS = ["message", "link", "level", "startAt", "endAt"] as const;
const STATUSES = ["active", "removed", "all"] as const;

function bannerItem(banner: any, users: Map<string, any>) {
  const author = users.get(String(banner.createdBy));
  return {
    _id: String(banner._id),
    message: banner.message ?? "",
    link: banner.link ?? "",
    level: banner.level,
    startAt: banner.startAt ?? null,
    endAt: banner.endAt ?? null,
    createdBy: {
      _id: String(banner.createdBy ?? ""),
      name: author?.name ?? "",
      customId: author?.customId ?? "",
    },
    removed: banner.removed ?? false,
    // Showing on the site right now
    live: isLive(banner),
    createdAt: banner.createdAt ?? null,
    updatedAt: banner.updatedAt ?? null,
  };
}

async function sendBanner(res: Response, banner: any) {
  const users = await AdminDB.usersByIds([banner.createdBy], {
    name: 1,
    customId: 1,
  });
  return res
    .status(HttpStatus.OK)
    .json({ status: CustomStatus.OK, data: bannerItem(banner, users) });
}

/** The fields present in the body, checked. */
function bannerFields(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  if (body.message !== undefined)
    update.message = boundedString(
      body.message,
      "message",
      BANNER_MESSAGE_MAX,
      { trim: true, min: 1 },
    );
  if (body.link !== undefined) update.link = linkValue(body.link);
  if (body.level !== undefined) {
    if (!BANNER_LEVELS.includes(body.level as BannerLevel))
      fail(
        CustomStatus.INVALID_BODY,
        `level must be one of: ${BANNER_LEVELS.join(", ")}`,
      );
    update.level = body.level;
  }
  if (body.startAt !== undefined)
    update.startAt = dateValue(body.startAt, "startAt");
  if (body.endAt !== undefined)
    update.endAt = body.endAt === null ? null : dateValue(body.endAt, "endAt");
  return update;
}

function checkWindow(startAt: unknown, endAt: unknown) {
  if (endAt && new Date(endAt as Date) <= new Date(startAt as Date))
    fail(CustomStatus.INVALID_BODY, "endAt must be after startAt");
}

// GET /admin/banners?status=active|removed|all&skip&limit (admin), newest
// first. `active` (default) is every banner that is not removed, including
// scheduled and ended ones; `live` says whether it is showing now.
export const listBanners: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const status = queryEnum(req, "status", STATUSES, "active");
    const filter: Filter = {};
    if (status !== "all") filter.removed = status === "removed";

    const [data, total] = await Promise.all([
      SiteBannerModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SiteBannerModel.countDocuments(filter),
    ]);
    const users = await AdminDB.usersByIds(
      data.map((banner: any) => banner.createdBy),
      { name: 1, customId: 1 },
    );
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((banner) => bannerItem(banner, users)),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/banners { message, link?, level?, startAt?, endAt? } (admin).
// level defaults to info and startAt to now.
export const createBanner: RequestHandler = async (req, res) => {
  try {
    const body = objectBody(req, FIELDS, { required: ["message"] });
    const fields = bannerFields(body);
    const startAt = (fields.startAt as Date | undefined) ?? new Date();
    checkWindow(startAt, fields.endAt);

    const actor = callerId(req);
    const banner = await SiteBannerModel.create({
      message: fields.message,
      link: fields.link ?? "",
      level: fields.level ?? "info",
      startAt,
      endAt: fields.endAt ?? null,
      createdBy: actor,
    });
    clearBannerCache();

    await recordAudit({
      actor,
      action: "banner.update",
      target: { kind: "banner", id: String(banner._id), label: banner.message },
      meta: { created: true },
    });
    return await sendBanner(res, banner.toObject());
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/banners/:id with any of the create fields (admin)
export const editBanner: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const fields = bannerFields(objectBody(req, FIELDS, { nonEmpty: true }));

    const current: any = await SiteBannerModel.findOne({
      _id: id,
      removed: false,
    }).lean();
    if (!current) fail(CustomStatus.NOT_FOUND, "Banner not found");
    checkWindow(
      fields.startAt ?? current.startAt,
      fields.endAt === undefined ? current.endAt : fields.endAt,
    );

    const banner: any = await SiteBannerModel.findOneAndUpdate(
      { _id: id, removed: false },
      { $set: fields },
      { returnDocument: "after" },
    ).lean();
    if (!banner) fail(CustomStatus.NOT_FOUND, "Banner not found");
    clearBannerCache();

    await recordAudit({
      actor: callerId(req),
      action: "banner.update",
      target: { kind: "banner", id, label: banner.message ?? "" },
      meta: { fields: Object.keys(fields) },
    });
    return await sendBanner(res, banner);
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /admin/banners/:id (admin): soft remove.
export const removeBanner: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const banner: any = await SiteBannerModel.findOneAndUpdate(
      { _id: id, removed: false },
      { $set: { removed: true } },
      { returnDocument: "after" },
    ).lean();
    if (!banner) fail(CustomStatus.NOT_FOUND, "Banner not found");
    clearBannerCache();

    await recordAudit({
      actor: callerId(req),
      action: "banner.update",
      target: { kind: "banner", id, label: banner.message ?? "" },
      meta: { removed: true },
    });
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: { _id: id, removed: true } });
  } catch (error) {
    return sendError(res, error);
  }
};
