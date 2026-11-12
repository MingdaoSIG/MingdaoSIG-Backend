import mongoose, { ClientSession } from "mongoose";

/**
 * Multi-document transactions need a replica set (or a sharded cluster). The
 * production MongoDB may be a single standalone server, where they are not
 * available: then the work runs without one, and callers order their writes
 * so that a failure part way can be finished by running the same operation
 * again (see @module/SigOperations).
 */

let supported: boolean | null = null;

/** Whether the connected server supports transactions (checked once). */
export async function transactionsSupported() {
  if (supported !== null) return supported;
  try {
    const hello = await mongoose.connection
      .getClient()
      .db("admin")
      .command({ hello: 1 });
    supported = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch (error) {
    console.warn(
      "Transaction : could not ask the server about transactions, running without:",
      error instanceof Error ? error.message : error,
    );
    supported = false;
  }
  return supported;
}

/**
 * Runs `work` in a transaction when the server supports one (the driver
 * retries it on transient errors, so `work` must start from scratch each
 * time), otherwise once with a null session.
 */
export async function withOptionalTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<{ result: T; transactional: boolean }> {
  if (!(await transactionsSupported()))
    return { result: await work(null), transactional: false };

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return { result: result as T, transactional: true };
  } finally {
    await session.endSession();
  }
}

/** Query options with the session, when there is one. */
export function sessionOption(session: ClientSession | null) {
  return session ? { session } : {};
}
