import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import { assertCustomIdAvailable } from "@module/CheckValidCustomId";
import { callerId, fail, pathId, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

const FIELDS = ["customId", "displayName", "description"];
const DISPLAY_NAME_MAX_LENGTH = 30;
// The same limit as POST /user.
const DESCRIPTION_MAX_LENGTH = 250;

// POST /admin/users/:id { customId?, displayName?, description? } (admin,
// contract v4 §5.8). Name, class and code come from the school system on
// every login and are not editable. A new customId must be unused by every
// other user and SIG (4022); the old one keeps redirecting.
export const updateUser: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");
    const keys = Object.keys(body);
    if (keys.length === 0 || keys.some((key) => !FIELDS.includes(key)))
      fail(
        CustomStatus.INVALID_BODY,
        `Body takes any of: ${FIELDS.join(", ")}`,
      );

    const before = await AdminDB.readUserProfile(id);
    if (!before) fail(CustomStatus.NOT_FOUND, "User not found");

    const set: Record<string, unknown> = {};
    const meta: Record<string, unknown> = {};

    if (body.displayName !== undefined) {
      if (typeof body.displayName !== "string")
        fail(CustomStatus.INVALID_BODY, "displayName must be a string");
      const displayName = body.displayName.trim();
      const length = Array.from(displayName).length;
      if (length < 1 || length > DISPLAY_NAME_MAX_LENGTH)
        fail(
          CustomStatus.INVALID_CONTENT_LENGTH,
          `displayName must be 1 to ${DISPLAY_NAME_MAX_LENGTH} characters`,
        );
      if (displayName !== (before.displayName ?? ""))
        set.displayName = displayName;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string")
        fail(CustomStatus.INVALID_BODY, "description must be a string");
      if (body.description.length > DESCRIPTION_MAX_LENGTH)
        fail(
          CustomStatus.INVALID_CONTENT_LENGTH,
          `description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
        );
      if (body.description !== (before.description ?? ""))
        set.description = body.description;
    }

    if (body.customId !== undefined && body.customId !== before.customId) {
      const next = await assertCustomIdAvailable(body.customId, {
        kind: "user",
        id,
      });
      const previous = before.customId ?? "";
      set.customId = next;
      set.previousCustomIds = Array.from(
        new Set([
          ...(before.previousCustomIds ?? []).filter(
            (old: string) => old !== next,
          ),
          ...(previous ? [previous] : []),
        ]),
      );
      meta.from = previous;
      meta.to = next;
    }

    const fields = Object.keys(set).filter(
      (field) => field !== "previousCustomIds",
    );
    let after = before;
    if (fields.length > 0) {
      after = await AdminDB.updateUserProfile(id, set, before.customId);
      // Renamed or taken meanwhile (the unique index on customId).
      if (!after)
        fail(
          CustomStatus.CUSTOM_ID_ALREADY_EXISTS,
          "The user's customId changed meanwhile, or the new one was taken",
        );

      await recordAudit({
        actor: callerId(req),
        action: "user.update",
        target: { kind: "user", id, label: before.name ?? "" },
        meta: { fields, ...meta },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: id,
        customId: after.customId ?? "",
        displayName: after.displayName ?? "",
        description: after.description ?? "",
        previousCustomIds: after.previousCustomIds ?? [],
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
