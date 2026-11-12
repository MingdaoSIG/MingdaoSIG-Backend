import { RequestHandler } from "express";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { ADMIN_PERMISSION } from "@module/Permission";
import { recordAudit } from "@module/Audit";
import {
  callerId,
  containsPattern,
  exactBody,
  fail,
  pagination,
  pathId,
  queryEnum,
  queryId,
  queryText,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();

const ROLES = ["all", "admin"] as const;
const MEMBER_PERMISSION = 1;

// GET /admin/users (admin): the list includes email and code.
export const listUsers: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const q = queryText(req);
    const role = queryEnum(req, "role", ROLES, "all");
    const sig = queryId(req, "sig");

    const filter: Filter = {};
    if (role === "admin") filter.permission = ADMIN_PERMISSION;
    if (sig) filter.sig = sig;
    if (q) {
      const pattern = containsPattern(q);
      filter.$or = [
        { name: pattern },
        { customId: pattern },
        { email: pattern },
        { code: pattern },
      ];
    }

    const { data, total } = await AdminDB.listUsers(filter, { skip, limit });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((user) => ({
        _id: String(user._id),
        name: user.name ?? "",
        customId: user.customId ?? "",
        email: user.email ?? "",
        code: user.code ?? "",
        class: user.class ?? "",
        identity: user.identity ?? "",
        avatar: user.avatar ?? "",
        permission: user.permission ?? null,
        badge: user.badge ?? [],
        sig: user.sig ?? [],
        createdAt: user.createdAt ?? null,
      })),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /admin/users/:id (admin)
export const readUser: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);

    const user = await AdminDB.readFullUser(id);
    if (!user) fail(CustomStatus.NOT_FOUND, "User not found");

    const memberSigIds: string[] = (user.sig ?? []).map(String);
    const activity = await AdminDB.userActivity(id, memberSigIds);

    const managedSigs = activity.managed.flatMap((sig) => {
      const roles: { _id: string; name: string; role: string }[] = [];
      const item = { _id: String(sig._id), name: sig.name ?? "" };
      if (sig.leader?.includes(id)) roles.push({ ...item, role: "leader" });
      if (sig.moderator?.includes(id))
        roles.push({ ...item, role: "moderator" });
      return roles;
    });

    // In the order of the user's own list; ids of deleted SIGs are left out.
    const sigNames = new Map(
      activity.memberSigs.map((sig) => [String(sig._id), sig.name ?? ""]),
    );
    const sigs = Array.from(new Set(memberSigIds))
      .filter((sigId) => sigNames.has(sigId))
      .map((sigId) => ({ _id: sigId, name: sigNames.get(sigId) }));

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        ...user,
        postCount: activity.postCount,
        commentCount: activity.commentCount,
        managedSigs,
        sigs,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/users/:id/permission { admin } (admin)
export const setPermission: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const { admin } = exactBody(req, ["admin"]);
    if (typeof admin !== "boolean")
      fail(CustomStatus.INVALID_BODY, "admin must be true or false");

    const actor = callerId(req);
    if (!admin && id === actor)
      fail(CustomStatus.FORBIDDEN, "You cannot remove your own admin role");

    const permission = admin ? ADMIN_PERMISSION : MEMBER_PERMISSION;
    let before: any;

    if (admin) {
      before = await AdminDB.setPermission(id, permission);
    } else {
      if ((await AdminDB.countAdmins()) <= 1) await refuseIfLastAdmin(id);
      before = await AdminDB.setPermission(id, permission);

      // Two admins demoting each other at the same time can both pass the
      // check above; whoever finds no admin left puts theirs back.
      if (
        before?.permission === ADMIN_PERMISSION &&
        (await AdminDB.countAdmins()) === 0
      ) {
        await AdminDB.setPermission(id, ADMIN_PERMISSION, permission);
        fail(CustomStatus.FORBIDDEN, "There must be at least one admin");
      }
    }

    // Recorded when the admin role changes (not for 0 or a missing value
    // becoming 1).
    if (before && (before.permission === ADMIN_PERMISSION) !== admin) {
      await recordAudit({
        actor,
        action: "user.permission",
        target: { kind: "user", id, label: before.name ?? "" },
        meta: { admin },
      });
    } else if (!before) {
      const user = await AdminDB.usersByIds([id], { _id: 1 });
      if (!user.has(id)) fail(CustomStatus.NOT_FOUND, "User not found");
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: id, permission },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// Called when at most one admin is left: refuses when `id` is that admin.
async function refuseIfLastAdmin(id: string) {
  const target = await AdminDB.usersByIds([id], { permission: 1 });
  if (!target.has(id)) fail(CustomStatus.NOT_FOUND, "User not found");
  if (target.get(id).permission === ADMIN_PERMISSION)
    fail(CustomStatus.FORBIDDEN, "There must be at least one admin");
}

// POST /admin/users/:id/badges { badges } (admin)
export const setBadges: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const { badges } = exactBody(req, ["badges"]);

    const allowed = AdminDB.badgeValues();
    if (
      !Array.isArray(badges) ||
      !badges.every(
        (badge) => typeof badge === "string" && allowed.includes(badge),
      )
    )
      fail(
        CustomStatus.INVALID_BODY,
        `badges must be a list of: ${allowed.join(", ")}`,
      );

    const next = Array.from(new Set(badges as string[]));
    const before = await AdminDB.setBadges(id, next);
    if (!before) fail(CustomStatus.NOT_FOUND, "User not found");

    const previous: string[] = before.badge ?? [];
    const changed =
      previous.length !== next.length ||
      next.some((badge) => !previous.includes(badge));
    if (changed) {
      await recordAudit({
        actor: callerId(req),
        action: "user.badges",
        target: { kind: "user", id, label: before.name ?? "" },
        meta: { badges: next },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: id, badge: next },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
