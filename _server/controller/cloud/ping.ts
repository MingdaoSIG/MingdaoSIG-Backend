import { readFileSync } from "fs";

import ReadableTime from "@module/ReadableTime/index.js";
import GetOnlineAppVersion from "@module/GetOnlineAppVersion";
import { RequestHandler } from "express";


export const ping: RequestHandler = async (req, res) => {
    const packageJSON = JSON.parse(readFileSync("./package.json").toString());
    const { mainVersion, developmentVersion } = await GetOnlineAppVersion();

    res.status(200).json({
        "service": "up",
        "uptime": ReadableTime(Math.round(performance.now()))["string"],
        "version": {
            "current": packageJSON.version,
            "latest": {
                "main": mainVersion,
                "development": developmentVersion
            },
            "upToDate": {
                "main": mainVersion === packageJSON.version,
                "development": developmentVersion === packageJSON.version
            }
        }
    });
};