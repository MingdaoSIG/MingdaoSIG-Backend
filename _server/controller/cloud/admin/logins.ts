import { RequestHandler, Response } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { listLogins } from "@module/LoginLog";
import { fail, pagination, pathId, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

// Login log (contract v4 §5.3), admin only. Items have the user's public
// fields; the IP is only ever its hash.

async function sendLogins(
  res: Response,
  filter: { user?: string },
  option: { skip: number; limit: number },
) {
  const { data, total } = await listLogins(filter, option);
  const users = await AdminDB.usersByIds(
    data.map((entry) => entry.user),
    { name: 1, customId: 1, avatar: 1 },
  );

  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    data: data.map((entry) => {
      const user = users.get(String(entry.user));
      return {
        _id: String(entry._id),
        user: {
          _id: String(entry.user ?? ""),
          name: user?.name ?? "",
          customId: user?.customId ?? "",
          avatar: user?.avatar ?? "",
        },
        method: entry.method,
        ipHash: entry.ipHash ?? "",
        userAgent: entry.userAgent ?? "",
        createdAt: entry.createdAt ?? null,
      };
    }),
    total,
  });
}

// GET /admin/logins?skip&limit (admin): newest first.
export const listAllLogins: RequestHandler = async (req, res) => {
  try {
    return await sendLogins(res, {}, pagination(req));
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /admin/users/:id/logins?skip&limit (admin): newest first.
export const listUserLogins: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const option = pagination(req);
    const user = await AdminDB.usersByIds([id], { _id: 1 });
    if (!user.has(id)) fail(CustomStatus.NOT_FOUND, "User not found");
    return await sendLogins(res, { user: id }, option);
  } catch (error) {
    return sendError(res, error);
  }
};
