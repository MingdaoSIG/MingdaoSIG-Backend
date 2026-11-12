import { Server, ServerResponse } from "node:http";
import mongoose from "mongoose";

// Docker Swarm sends SIGKILL 10 s after SIGTERM by default, so drain in less.
const DEFAULT_TIMEOUT_MS = 8000;

let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;
let httpServer: Server | undefined;
const activeResponses = new Set<ServerResponse>();
const shutdownTasks: (() => Promise<unknown> | unknown)[] = [];
// Background tasks (the digest scheduler) get this long to stop.
const TASK_TIMEOUT_MS = 3000;

export function isShuttingDown() {
  return shuttingDown;
}

/**
 * Tracks in-flight responses so a shutdown can wait for them and close
 * keep-alive sockets as soon as their last response is done.
 */
export function attachServer(server: Server) {
  httpServer = server;

  server.on("request", (_req, res: ServerResponse) => {
    activeResponses.add(res);
    if (shuttingDown) res.setHeader("Connection", "close");

    res.on("close", () => {
      activeResponses.delete(res);
      if (shuttingDown) setImmediate(() => server.closeIdleConnections());
    });
  });
}

/**
 * Registers a task to run first on shutdown, e.g. stopping a scheduler. Its
 * errors are logged; the shutdown waits for it up to a few seconds.
 */
export function onShutdown(task: () => Promise<unknown> | unknown) {
  shutdownTasks.push(task);
}

/**
 * Runs the onShutdown tasks, stops accepting connections, lets in-flight
 * requests finish (up to timeoutMs), closes the MongoDB connection and
 * exits. Safe to call more than once; later calls wait for the first one.
 */
export function shutdown(
  reason: string,
  exitCode = 0,
  timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  console.warn(`Server : ${reason} received, shutting down`);

  shutdownPromise = (async () => {
    await runShutdownTasks(Math.min(timeoutMs, TASK_TIMEOUT_MS));
    if (httpServer) await drain(httpServer, timeoutMs);

    try {
      await mongoose.disconnect();
      console.warn("Server : MongoDB connection closed");
    } catch (error: any) {
      console.error(
        `Server : failed to close MongoDB connection: ${error?.message}`,
      );
    }

    console.warn(`Server : shutdown complete, exit code ${exitCode}`);
    process.exit(exitCode);
  })();

  return shutdownPromise;
}

async function runShutdownTasks(timeoutMs: number) {
  if (shutdownTasks.length === 0) return;
  const tasks = Promise.allSettled(
    shutdownTasks.map(async (task) => {
      try {
        await task();
      } catch (error: any) {
        console.error(`Server : shutdown task failed: ${error?.message}`);
      }
    }),
  );

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  const didTimeOut = await Promise.race([tasks.then(() => false), timedOut]);
  clearTimeout(timer);
  if (didTimeOut) {
    console.warn(
      `Server : shutdown tasks still running after ${timeoutMs} ms, continuing`,
    );
  }
}

async function drain(server: Server, timeoutMs: number) {
  // Ask clients of requests that have not answered yet to drop the socket.
  for (const res of activeResponses) {
    if (!res.headersSent) res.setHeader("Connection", "close");
  }

  const closed = new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  server.closeIdleConnections();

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });

  const didTimeOut = await Promise.race([closed.then(() => false), timedOut]);
  clearTimeout(timer);

  if (didTimeOut) {
    console.warn(
      `Server : ${activeResponses.size} request(s) still running after ${timeoutMs} ms, closing their connections`,
    );
    server.closeAllConnections();
  } else {
    console.warn("Server : all connections drained");
  }
}
