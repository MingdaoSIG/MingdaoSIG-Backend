import mongoose, { mongo } from "mongoose";

import { isShuttingDown } from "@module/GracefulShutdown";

let running = false;
let finished = false;
let resumeRegistered = false;

/**
 * Builds every index declared on the registered Mongoose schemas, one at a
 * time. Runs in the background after the server starts listening: a slow or
 * failing build (for example a unique index over duplicate data) is logged and
 * never blocks or crashes startup. createIndex is a no-op for an index that
 * already exists with the same options.
 *
 * If the MongoDB connection drops during the run, it stops and runs again
 * after the driver reconnects.
 */
export default async function EnsureIndexes(): Promise<void> {
  registerResume();
  if (running || finished) return;
  running = true;

  try {
    for (const model of Object.values(mongoose.models)) {
      const collectionName = model.collection.collectionName;

      for (const [fields, options] of model.schema.indexes()) {
        if (isShuttingDown() || connectionLost()) return;

        // The schemas only declare driver index options (no custom unique
        // error messages), so this cast is safe.
        const indexOptions = options as mongo.CreateIndexesOptions;
        try {
          await dropIfUniquenessChanged(model.collection, fields, indexOptions);
          const name = await model.collection.createIndex(
            fields as Record<string, 1 | -1>,
            indexOptions,
          );
          console.log(`MongoDB : index ready ${collectionName}.${name}`);
        } catch (error: any) {
          console.error(
            `MongoDB : failed to build index ${JSON.stringify(
              fields,
            )} ${JSON.stringify(options)} on "${collectionName}": ${
              error?.message
            }`,
          );
          // A build cut off by a dropped connection runs again on reconnect.
          if (connectionLost()) return;
        }
      }
    }
    finished = true;
  } finally {
    running = false;
  }
}

/**
 * createIndex fails when an index with the same key already exists with
 * other options. When a schema turns a plain index into a unique one (as
 * user.email and user.customId did), drop the old one first. The unique
 * build then fails safely (and is logged) if duplicates exist.
 */
async function dropIfUniquenessChanged(
  collection: mongoose.mongo.Collection,
  fields: object,
  options: { unique?: boolean } | undefined,
) {
  const existing = await collection.indexes().catch(() => []);
  const key = JSON.stringify(fields);
  const match = existing.find(
    (index) => index.name !== "_id_" && JSON.stringify(index.key) === key,
  );
  if (!match || Boolean(match.unique) === Boolean(options?.unique)) return;

  await collection.dropIndex(String(match.name));
  console.log(
    `MongoDB : dropped index ${collection.collectionName}.${match.name} to rebuild it with unique: ${Boolean(options?.unique)}`,
  );
}

function connectionLost() {
  if (mongoose.connection.readyState === 1) return false;
  if (!isShuttingDown()) {
    console.warn(
      "MongoDB : connection lost, index build continues after reconnecting",
    );
  }
  return true;
}

function registerResume() {
  if (resumeRegistered) return;
  resumeRegistered = true;

  mongoose.connection.on("reconnected", () => {
    if (finished || isShuttingDown()) return;
    EnsureIndexes().catch((error) => {
      console.error("MongoDB : index build stopped:", error);
    });
  });
}
