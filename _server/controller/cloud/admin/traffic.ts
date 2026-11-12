import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import {
  TRAFFIC_RANGES,
  TrafficRange,
  loadTraffic,
  umamiConfig,
} from "@module/UmamiTraffic";
import { queryEnum, sendError } from "./_shared";

const RANGES = Object.keys(TRAFFIC_RANGES) as TrafficRange[];

// GET /admin/traffic?range=7d|30d|90d (admin, default 30d): page views,
// visitors and visits from Umami, cached for 10 minutes. 503/5000 while
// UMAMI_DATABASE_URL / UMAMI_WEBSITE_ID are not set.
export const traffic: RequestHandler = async (req, res) => {
  try {
    const range = queryEnum(req, "range", RANGES, "30d");
    if (!umamiConfig().enabled) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: CustomStatus.UNKNOWN_ERROR,
        message: "Traffic is not configured",
      });
    }

    let data: Awaited<ReturnType<typeof loadTraffic>>;
    try {
      data = await loadTraffic(range);
    } catch (error: any) {
      // pg messages name the problem (refused, timeout, permission), never
      // the connection string.
      console.error(`Traffic : Umami query failed: ${error?.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: CustomStatus.UNKNOWN_ERROR,
        message: "Could not read traffic",
      });
    }

    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};
