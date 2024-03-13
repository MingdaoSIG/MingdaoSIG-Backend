import { readFileSync } from "fs";

import ReadableTime from "@module/ReadableTime/index.js";
import GetOnlineAppVersion from "@module/GetOnlineAppVersion";
import { RequestHandler } from "express";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";


export const ping: RequestHandler = async (req, res) => {
  try {
    const packageJSON = JSON.parse(
      readFileSync("./package.json").toString()
    );
    const { mainVersion, developmentVersion } = await GetOnlineAppVersion();

    res.status(HttpStatus.OK).json({
      service: "up",
      uptime: ReadableTime(Math.round(performance.now()))["string"],
      version: {
        current: packageJSON.version,
        latest: {
          main: mainVersion,
          development: developmentVersion
        },
        upToDate: {
          main: mainVersion === packageJSON.version,
          development: developmentVersion === packageJSON.version
        }
      }
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
