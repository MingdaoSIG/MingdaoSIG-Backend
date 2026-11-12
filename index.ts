/* eslint-disable no-console */
import dotenv from "dotenv";

import server from "./_server";
import ValidateEnv from "@module/ValidateEnv";
import ConnectMongoDB from "@module/ConnectMongoDB";
import EnsureIndexes from "@module/EnsureIndexes";
import { prefetchOnlineAppVersion } from "@module/GetOnlineAppVersion";
import {
  attachServer,
  isShuttingDown,
  shutdown
} from "@module/GracefulShutdown";


dotenv.config();

// A closed stdout/stderr (EPIPE) must not turn every log line into an
// uncaught exception that logs again and spins the CPU.
process.stdout.on("error", () => undefined);
process.stderr.on("error", () => undefined);

process.on("unhandledRejection", reason => {
  console.error("Process : unhandled promise rejection:", reason);
});
process.on("uncaughtException", error => {
  // The process state is unknown after this, so drain and exit; the
  // orchestrator restarts the container and startup no longer crash-loops.
  console.error("Process : uncaught exception:", error);
  shutdown("uncaughtException", 1);
});
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const env = ValidateEnv();

async function start() {
  const connected = await ConnectMongoDB(env.MONGO_URI, {
    shouldStop: isShuttingDown
  });
  if (!connected || isShuttingDown()) return;

  server.set("host", env.HOST);
  server.set("port", env.PORT);
  const httpServer = server.listen(env.PORT, env.HOST, () => {
    console.log(`Server : listening on http://${env.HOST}:${env.PORT}`);
  });
  httpServer.on("error", error => {
    console.error("Server : HTTP server error:", error);
    shutdown("HTTP server error", 1);
  });
  attachServer(httpServer);

  EnsureIndexes().catch(error => {
    console.error("MongoDB : index build stopped:", error);
  });
  prefetchOnlineAppVersion();
}

start().catch(error => {
  console.error("Server : failed to start:", error);
  process.exit(1);
});
