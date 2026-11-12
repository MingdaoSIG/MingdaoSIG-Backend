import { RequestHandler } from "express";
import mongoose from "mongoose";

import { HttpStatus } from "@module/HttpStatusCode";
import { isShuttingDown } from "@module/GracefulShutdown";


const MONGO_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

// Liveness and readiness for the orchestrator: 200 only while MongoDB is
// connected and the server is not draining for a shutdown.
export const healthz: RequestHandler = (_, res) => {
  const readyState = mongoose.connection.readyState;
  const mongo = MONGO_STATES[readyState] || "unknown";
  const healthy = readyState === 1 && !isShuttingDown();

  res
    .status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    .set("Cache-Control", "no-store")
    .json({
      status: healthy ? "ok" : "unavailable",
      mongo,
      shuttingDown: isShuttingDown()
    });
};
