import { RequestHandler } from "express";

import { SigWrite } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { recordAudit } from "@module/Audit";
import { assertCustomIdAvailable } from "@module/CheckValidCustomId";
import {
  parseImageId,
  parseSigColor,
  parseSigDescription,
  parseSigName,
  toSigResponse,
} from "@module/SigSettings";
import { callerId, fail, sendError } from "./_shared";

const SigDB = new MongoDB.Sig();

const REQUIRED = ["name", "customId"];
const OPTIONAL = ["description", "avatar", "color", "defaultCover"];

// POST /admin/sigs { name, customId, description?, avatar?, color?,
// defaultCover? } (admin, contract v4 §3.7): creates a SIG and returns it.
export const createSig: RequestHandler = async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");
    const keys = Object.keys(body);
    const missing = REQUIRED.filter((key) => body[key] === undefined);
    const extra = keys.filter(
      (key) => !REQUIRED.includes(key) && !OPTIONAL.includes(key),
    );
    if (missing.length > 0 || extra.length > 0)
      fail(
        CustomStatus.INVALID_BODY,
        `Body takes ${REQUIRED.join(", ")} and optionally ${OPTIONAL.join(", ")}`,
      );

    const data: SigWrite = {
      name: parseSigName(body.name),
      description:
        body.description === undefined
          ? ""
          : parseSigDescription(body.description),
      avatar:
        body.avatar === undefined
          ? ""
          : await parseImageId(body.avatar, "avatar"),
    };
    if (body.color !== undefined) data.color = parseSigColor(body.color);
    if (body.defaultCover !== undefined)
      data.defaultCover = await parseImageId(body.defaultCover, "defaultCover");
    data.customId = await assertCustomIdAvailable(body.customId, {
      kind: "sig",
    });

    const created = await SigDB.create(data);
    const id = String(created._id);

    await recordAudit({
      actor: callerId(req),
      action: "sig.update",
      target: { kind: "sig", id, label: created.name ?? "" },
      meta: { created: true },
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id,
      data: toSigResponse(created),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
