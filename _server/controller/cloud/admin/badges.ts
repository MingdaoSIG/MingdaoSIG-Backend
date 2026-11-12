import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import {
  BADGE_DESCRIPTION_MAX_LENGTH,
  BADGE_KEY_PATTERN,
  BADGE_NAME_MAX_LENGTH,
  BadgeModel,
  clearBadgeCache,
  listActiveBadges,
  listAllBadges,
  toBadgeItem,
} from "@module/Badge";
import { parseImageId } from "@module/SigSettings";
import { callerId, fail, sendError } from "./_shared";

// Badges (API contract v4 §5.9). GET /badge/list is public; the /admin
// routes are admin only.

const AdminDB = new MongoDB.Admin();

const FIELDS = ["key", "name", "description", "icon", "color", "removed"];
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// GET /badge/list: badges that are not retired, without timestamps.
export const listBadges: RequestHandler = async (_req, res) => {
  try {
    const badges = await listActiveBadges();
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: badges.map(({ removed, createdAt, updatedAt, ...badge }) => badge),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /admin/badges: every badge, retired ones included, with the number
// of users who have it.
export const listAdminBadges: RequestHandler = async (_req, res) => {
  try {
    const [badges, counts] = await Promise.all([
      listAllBadges(),
      AdminDB.badgeUserCounts(),
    ]);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: badges.map((badge) => ({
        ...badge,
        userCount: counts[badge.key] ?? 0,
      })),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

function parseText(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, `${field} must be a string`);
  const text = value.trim();
  const length = Array.from(text).length;
  if (length < min || length > max)
    fail(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `${field} must be ${min} to ${max} characters`,
    );
  return text;
}

// POST /admin/badges { key, name?, description?, icon?, color?, removed? }:
// creates the badge when the key is new (name required), otherwise updates
// the fields given. icon is an image id, or "" for none; color is #rrggbb
// or "". removed: false restores a retired badge.
export const saveBadge: RequestHandler = async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");
    const extra = Object.keys(body).filter((key) => !FIELDS.includes(key));
    if (extra.length > 0)
      fail(CustomStatus.INVALID_BODY, `Body takes: ${FIELDS.join(", ")}`);
    if (typeof body.key !== "string" || !BADGE_KEY_PATTERN.test(body.key))
      fail(
        CustomStatus.INVALID_BODY,
        "key must be 1 to 30 characters: a-z, 0-9, _, . and -",
      );

    const set: Record<string, unknown> = {};
    if (body.name !== undefined)
      set.name = parseText(body.name, "name", 1, BADGE_NAME_MAX_LENGTH);
    if (body.description !== undefined)
      set.description = parseText(
        body.description,
        "description",
        0,
        BADGE_DESCRIPTION_MAX_LENGTH,
      );
    if (body.icon !== undefined)
      set.icon = body.icon === "" ? "" : await parseImageId(body.icon, "icon");
    if (body.color !== undefined) {
      if (
        typeof body.color !== "string" ||
        (body.color !== "" && !COLOR_PATTERN.test(body.color))
      )
        fail(CustomStatus.INVALID_BODY, 'color must be #rrggbb or ""');
      set.color = body.color.toLowerCase();
    }
    if (body.removed !== undefined) {
      if (typeof body.removed !== "boolean")
        fail(CustomStatus.INVALID_BODY, "removed must be true or false");
      set.removed = body.removed;
    }

    const existing = await BadgeModel.findOne({ key: body.key }).lean();
    let saved: any;
    let created = false;
    if (existing) {
      // Only what changes is written and recorded.
      for (const [field, value] of Object.entries(set))
        if ((existing as any)[field] === value) delete set[field];
      saved =
        Object.keys(set).length > 0
          ? await BadgeModel.findOneAndUpdate(
              { key: body.key },
              { $set: set },
              { returnDocument: "after" },
            ).lean()
          : existing;
    } else {
      if (set.name === undefined)
        fail(CustomStatus.INVALID_BODY, "name is required for a new badge");
      try {
        saved = (
          await BadgeModel.create({ key: body.key, removed: false, ...set })
        ).toObject();
        created = true;
      } catch (error: any) {
        if (error?.code === 11000)
          fail(
            CustomStatus.INVALID_BODY,
            "A badge with this key was just created",
          );
        throw error;
      }
    }

    const fields = Object.keys(set);
    if (created || fields.length > 0) {
      clearBadgeCache();
      await recordAudit({
        actor: callerId(req),
        action: "badge.update",
        target: {
          kind: "badge",
          id: String(saved._id),
          label: saved.name ?? "",
        },
        meta: {
          key: body.key,
          ...(created ? { created: true } : {}),
          fields,
        },
      });
    }

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: toBadgeItem(saved) });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /admin/badges/:key (or DELETE /admin/badges with { key } or
// ?key=): retires the badge (removed: true). Users who have it keep it; it
// is hidden from GET /badge/list and new assignments.
export const retireBadge: RequestHandler = async (req, res) => {
  try {
    const key = req.params.key ?? req.body?.key ?? req.query.key;
    if (typeof key !== "string" || !BADGE_KEY_PATTERN.test(key))
      fail(CustomStatus.NOT_FOUND, "Invalid badge key");

    const before = await BadgeModel.findOneAndUpdate(
      { key },
      { $set: { removed: true } },
      { returnDocument: "before" },
    ).lean();
    if (!before) fail(CustomStatus.NOT_FOUND, "Badge not found");

    if (!(before as any).removed) {
      clearBadgeCache();
      await recordAudit({
        actor: callerId(req),
        action: "badge.update",
        target: {
          kind: "badge",
          id: String((before as any)._id),
          label: (before as any).name ?? "",
        },
        meta: { key, fields: ["removed"], removed: true },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: toBadgeItem({ ...before, removed: true }),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
