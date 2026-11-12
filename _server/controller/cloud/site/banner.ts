import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { currentBanner, publicBanner } from "@module/SiteBanner";
import { sendError } from "../admin/_shared";

// GET /site/banner (public, cached 60 s): the banner to show now, or null.
export const readBanner: RequestHandler = async (_req, res) => {
  try {
    const banner = await currentBanner();
    res.set("Cache-Control", "public, max-age=60");
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: banner ? publicBanner(banner) : null,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
