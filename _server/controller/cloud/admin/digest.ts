import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { composeDigest, digestEnabled } from "@module/WeeklyDigest";
import { caller, fail, sendError } from "./_shared";

// POST /admin/digest/preview (admin): the weekly digest the caller would get
// now, for testing. Sends nothing and changes nothing; works whether or not
// the caller opted in.
export const previewDigest: RequestHandler = async (req, res) => {
  try {
    const body = req.body;
    if (
      body !== undefined &&
      (typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    )
      fail(CustomStatus.INVALID_BODY, "Body must be empty");

    const user = caller(req);
    const digest = await composeDigest(user);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { ...digest, optedIn: digestEnabled(user) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
