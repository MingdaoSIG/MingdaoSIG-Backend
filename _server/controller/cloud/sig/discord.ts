import { RequestHandler } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { canManageSig } from "@module/Permission";
import { isValidDiscordWebhook, sendDiscordTest } from "@module/DiscordWebhook";
import {
  caller,
  fail,
  pathId,
  sendError,
} from "@controller/cloud/admin/_shared";

// SIG Discord announcements (API contract v4 §3.6).

const SigDB = new MongoDB.Sig();

/**
 * `discordWebhook` for POST /sig/:id: a Discord webhook URL, or "" to clear
 * it; anything else is 4011. The value is never echoed in the error.
 */
export function parseDiscordWebhook(value: unknown) {
  if (value === "") return "";
  if (!isValidDiscordWebhook(value))
    throw new CustomError(
      CustomStatus.INVALID_BODY,
      new Error("discordWebhook must be a Discord webhook URL or empty"),
    );
  return value;
}

// POST /sig/:id/discord/test (the SIG's managers or an admin): sends a test
// message to the SIG's webhook. `ok` is false when no webhook is set or
// Discord did not accept the message within 5 s.
export const testDiscordWebhook: RequestHandler<
  Record<string, string>
> = async (req, res) => {
  try {
    const sigId = pathId(req, "id");
    const sigData = await SigDB.read({ id: sigId }).catch(() => null);
    if (!sigData) fail(CustomStatus.NOT_FOUND, "Sig not found");
    if (!canManageSig(caller(req), sigData))
      fail(CustomStatus.FORBIDDEN, "Not admin or manager of this sig");

    const ok = await sendDiscordTest(sigId, sigData.name ?? "");
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { ok },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
