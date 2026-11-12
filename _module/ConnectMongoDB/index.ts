/* eslint-disable no-console */
import mongoose from "mongoose";


const FIRST_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30 * 1000;
const SERVER_SELECTION_TIMEOUT_MS = 5000;

type ConnectOptions = {
  // Checked between attempts, so a shutdown signal stops the retry loop.
  shouldStop?: () => boolean;
};

/**
 * Connects to MongoDB and keeps retrying with exponential backoff (1 s, 2 s,
 * 4 s ... capped at 30 s) until it succeeds. On a VM boot the app often starts
 * before mongod accepts connections, so a failed first attempt must not crash
 * the process. After the first success the driver reconnects on its own.
 *
 * Resolves to false when shouldStop() turned true before a connection was made.
 */
export default async function ConnectMongoDB(
  uri: string,
  options: ConnectOptions = {}
): Promise<boolean> {
  mongoose.set("strictQuery", false);
  registerConnectionLogs();

  for (let attempt = 1; ; attempt++) {
    if (options.shouldStop?.()) return false;

    try {
      const db = await mongoose.connect(uri, {
        authSource: "admin",
        dbName: "backend",
        // Indexes are built in the background by EnsureIndexes, which logs
        // failures instead of swallowing them.
        autoIndex: false,
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS
      });
      console.log(
        `MongoDB : connected, database name: "${db.connections[0].name}"`
      );
      return true;
    }
    catch (error: any) {
      const delay = Math.min(
        FIRST_RETRY_DELAY_MS * 2 ** (attempt - 1),
        MAX_RETRY_DELAY_MS
      );
      console.error(
        `MongoDB : connection attempt ${attempt} failed (${
          error?.name || "Error"
        }: ${error?.message}), retrying in ${delay / 1000} s`
      );
      await sleep(delay);
    }
  }
}

let logsRegistered = false;
function registerConnectionLogs() {
  if (logsRegistered) return;
  logsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB : disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.warn("MongoDB : reconnected");
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
