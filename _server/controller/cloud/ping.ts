import { readFileSync } from "node:fs";

import ReadableTime from "@module/ReadableTime/index.js";
import GetOnlineAppVersion from "@module/GetOnlineAppVersion";
import { RequestHandler } from "express";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";

let currentVersion: string | undefined;
function getCurrentVersion() {
  if (!currentVersion) {
    currentVersion = JSON.parse(readFileSync("./package.json").toString())
      .version as string;
  }
  return currentVersion;
}

export const ping: RequestHandler = async (_req, res) => {
  try {
    const current = getCurrentVersion();
    // Cached and never throws, so GitHub being down cannot fail the ping.
    const { mainVersion, developmentVersion } = await GetOnlineAppVersion();

    res.status(HttpStatus.OK).json({
      service: "up",
      uptime: ReadableTime(Math.round(performance.now())).string,
      version: {
        current,
        latest: {
          main: mainVersion,
          development: developmentVersion,
        },
        upToDate: {
          main: mainVersion === current,
          development: developmentVersion === current,
        },
      },
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
