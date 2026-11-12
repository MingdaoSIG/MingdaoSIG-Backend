import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import {
  AUDIT_ACTIONS,
  AuditAction,
  AuditTargetKind,
  listAudit,
} from "@module/Audit";
import { pagination, queryEnum, queryId, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

const TARGET_KINDS: readonly AuditTargetKind[] = [
  "post",
  "comment",
  "user",
  "sig",
  "join",
];

// GET /admin/audit (admin): newest first.
export const listAuditEntries: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const action = queryEnum<AuditAction | "">(
      req,
      "action",
      AUDIT_ACTIONS,
      "",
    );
    const targetKind = queryEnum<AuditTargetKind | "">(
      req,
      "targetKind",
      TARGET_KINDS,
      "",
    );
    const actor = queryId(req, "actor");
    const targetId = queryId(req, "targetId");

    const { data, total } = await listAudit(
      {
        action: action || undefined,
        actor,
        targetKind: targetKind || undefined,
        targetId,
      },
      { skip, limit },
    );

    const actors = await AdminDB.usersByIds(
      data.map((entry: any) => entry.actor),
      { name: 1, customId: 1 },
    );

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((entry: any) => {
        const user = actors.get(String(entry.actor));
        return {
          _id: String(entry._id),
          actor: {
            _id: entry.actor,
            name: user?.name ?? "",
            customId: user?.customId ?? "",
          },
          action: entry.action,
          target: {
            kind: entry.target?.kind,
            id: entry.target?.id,
            label: entry.target?.label ?? "",
          },
          meta: entry.meta ?? {},
          createdAt: entry.createdAt,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
