import { Request, RequestHandler, Response } from "express";
import { ClientSession, isValidObjectId } from "mongoose";

import { CustomCode, CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { ANNOUNCEMENT_SIG_ID } from "@module/Permission";
import { recordAudit } from "@module/Audit";
import {
  transactionsSupported,
  withOptionalTransaction,
} from "@module/Transaction";
import {
  LeaderAssignment,
  PostSelection,
  applyLeaders,
  applyMerge,
  applyRollover,
  leaderChanges,
  movePosts,
  planMerge,
  planPostMove,
  rolloverPreview,
  sigSummary,
} from "@module/SigOperations";
import { callerId, fail, pathId, sendError } from "./_shared";

// Year rollover, SIG merge, moving posts and batch leaders (API contract v4
// §5.7). Admin only. Each change takes `dryRun` (the rollover also has its
// preview) and answers with counts.

const SigDB = new MongoDB.Sig();
const AdminDB = new MongoDB.Admin();

const MAX_MOVE_IDS = 500;
const MAX_ASSIGNMENTS = 100;
const MAX_LEADERS = 20;

type Progress = Record<string, number>;

class PartialFailure extends Error {
  constructor(
    readonly cause: unknown,
    readonly progress: Progress,
    readonly transactional: boolean,
  ) {
    super("Operation failed part way");
  }
}

/**
 * Runs an apply step, in a transaction when MongoDB has them. A failure
 * without one reports what was already changed: running the same request
 * again finishes it.
 */
async function runApply<T>(
  work: (session: ClientSession | null, progress: Progress) => Promise<T>,
) {
  const progress: Progress = {};
  try {
    return await withOptionalTransaction((session) => work(session, progress));
  } catch (error) {
    throw new PartialFailure(error, progress, await transactionsSupported());
  }
}

function sendFailure(res: Response, error: unknown) {
  if (!(error instanceof PartialFailure)) return sendError(res, error);
  console.error(
    `Admin : ${res.req?.method} ${res.req?.baseUrl}${res.req?.path} failed:`,
    error.cause instanceof Error ? error.cause.message : error.cause,
  );
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: CustomStatus.UNKNOWN_ERROR,
    message: error.transactional
      ? `${CustomCode[CustomStatus.UNKNOWN_ERROR]}: nothing was changed`
      : `${CustomCode[CustomStatus.UNKNOWN_ERROR]}: stopped part way, send the same request again to finish`,
    data: {
      transactional: error.transactional,
      completed: error.transactional ? {} : error.progress,
    },
  });
}

/** The JSON body: an object with only `allowed` keys (4011 otherwise). */
function bodyWith(req: Request, allowed: string[]) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(CustomStatus.INVALID_BODY, "Body must be a JSON object");
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length > 0)
    fail(
      CustomStatus.INVALID_BODY,
      `Unknown body keys: ${extra.join(", ")} (allowed: ${allowed.join(", ")})`,
    );
  return body as Record<string, unknown>;
}

function dryRunOf(body: Record<string, unknown>) {
  if (body.dryRun === undefined) return false;
  if (typeof body.dryRun !== "boolean")
    fail(CustomStatus.INVALID_BODY, "dryRun must be true or false");
  return body.dryRun;
}

function isActive(sigData: { _id?: unknown; removed?: boolean }) {
  return !sigData.removed || String(sigData._id) === ANNOUNCEMENT_SIG_ID;
}

/** A SIG posts and members can be moved into: it exists and is active. */
async function targetSig(id: unknown, field: string) {
  if (typeof id !== "string" || !isValidObjectId(id))
    fail(CustomStatus.INVALID_BODY, `${field} must be a SIG id`);
  const sigData = await SigDB.read({ id }).catch(() => null);
  if (!sigData) fail(CustomStatus.INVALID_SIG_ID, `${field}: SIG not found`);
  if (!isActive(sigData))
    fail(CustomStatus.INVALID_SIG_ID, `${field}: the SIG is archived`);
  return sigData;
}

// POST /admin/posts/move { ids: [...] (1-500) | fromSig, toSig, dryRun? }
export const movePostsHandler: RequestHandler = async (req, res) => {
  try {
    const body = bodyWith(req, ["ids", "fromSig", "toSig", "dryRun"]);
    const dryRun = dryRunOf(body);

    let selection: PostSelection;
    if (body.ids !== undefined && body.fromSig === undefined) {
      const { ids } = body;
      if (
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > MAX_MOVE_IDS ||
        !ids.every((id) => typeof id === "string" && isValidObjectId(id))
      )
        fail(
          CustomStatus.INVALID_BODY,
          `ids must be 1 to ${MAX_MOVE_IDS} post ids`,
        );
      selection = { ids: Array.from(new Set(ids as string[])) };
    } else if (body.fromSig !== undefined && body.ids === undefined) {
      if (typeof body.fromSig !== "string" || !isValidObjectId(body.fromSig))
        fail(CustomStatus.INVALID_BODY, "fromSig must be a SIG id");
      selection = { fromSig: body.fromSig };
    } else {
      fail(CustomStatus.INVALID_BODY, "Give either ids or fromSig");
    }

    const toSig = await targetSig(body.toSig, "toSig");
    const to = String(toSig._id);
    if ("fromSig" in selection && selection.fromSig === to)
      fail(CustomStatus.INVALID_BODY, "fromSig and toSig are the same SIG");

    if (dryRun) {
      const plan = await planPostMove(selection, toSig);
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: { dryRun, ...plan, to },
      });
    }

    const { result, transactional } = await runApply((session, progress) =>
      movePosts(selection, toSig, session, progress),
    );
    if (result.count > 0) {
      await recordAudit({
        actor: callerId(req),
        action: "post.move",
        target: { kind: "sig", id: to, label: toSig.name ?? "" },
        meta: { count: result.count, from: result.from, to },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { dryRun, ...result, to, transactional },
    });
  } catch (error) {
    return sendFailure(res, error);
  }
};

// POST /admin/sigs/:id/merge { into, dryRun? }
export const mergeSig: RequestHandler = async (req, res) => {
  try {
    const sourceId = pathId(req);
    const body = bodyWith(req, ["into", "dryRun"]);
    const dryRun = dryRunOf(body);

    const source = await SigDB.read({ id: sourceId }).catch(() => null);
    if (!source) fail(CustomStatus.NOT_FOUND, "SIG not found");
    if (sourceId === ANNOUNCEMENT_SIG_ID)
      fail(CustomStatus.FORBIDDEN, "The announcement SIG cannot be merged");
    if (body.into === sourceId)
      fail(CustomStatus.INVALID_BODY, "A SIG cannot be merged into itself");
    const target = await targetSig(body.into, "into");

    const summary = {
      source: sigSummary(source),
      into: sigSummary(target),
    };

    if (dryRun) {
      const plan = await planMerge(source, target);
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: { dryRun, ...summary, ...plan },
      });
    }

    const { result, transactional } = await runApply((session, progress) =>
      applyMerge(source, target, session, progress),
    );

    await recordAudit({
      actor: callerId(req),
      action: "sig.merge",
      target: { kind: "sig", id: sourceId, label: source.name ?? "" },
      meta: {
        into: String(target._id),
        posts: result.posts,
        covers: result.covers,
        membersAdded: result.members.added,
        membersRemoved: result.members.removedFromSource,
        joinRequestsMoved: result.joinRequests.moved,
        joinRequestsRejected: result.joinRequests.rejected,
        previousCustomIds: result.previousCustomIds,
      },
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { dryRun, ...summary, ...result, archived: true, transactional },
    });
  } catch (error) {
    return sendFailure(res, error);
  }
};

// GET /admin/rollover/preview
export const previewRollover: RequestHandler = async (_req, res) => {
  try {
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await rolloverPreview(),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/rollover/apply { removeAlumniFromSigs, removeAlumniLeaders,
// dryRun? }
export const applyRolloverHandler: RequestHandler = async (req, res) => {
  try {
    const body = bodyWith(req, [
      "removeAlumniFromSigs",
      "removeAlumniLeaders",
      "dryRun",
    ]);
    const dryRun = dryRunOf(body);
    const { removeAlumniFromSigs, removeAlumniLeaders } = body;
    if (
      typeof removeAlumniFromSigs !== "boolean" ||
      typeof removeAlumniLeaders !== "boolean"
    )
      fail(
        CustomStatus.INVALID_BODY,
        "removeAlumniFromSigs and removeAlumniLeaders must be true or false",
      );
    const options = { removeAlumniFromSigs, removeAlumniLeaders };

    if (dryRun) {
      const plan = await applyRollover({ ...options, dryRun }, null);
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: { dryRun, ...options, ...plan },
      });
    }

    const { result, transactional } = await runApply((session, progress) =>
      applyRollover(options, session, progress),
    );

    if (result.users > 0 || result.managers.length > 0) {
      await recordAudit({
        actor: callerId(req),
        action: "rollover.apply",
        target: { kind: "site", id: "rollover", label: "學年交接" },
        meta: {
          ...options,
          users: result.users,
          memberships: result.memberships,
          leadersRemoved: result.leadersRemoved,
          moderatorsRemoved: result.moderatorsRemoved,
          managers: result.managers,
        },
      });
    }

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { dryRun, ...options, ...result, transactional },
    });
  } catch (error) {
    return sendFailure(res, error);
  }
};

// POST /admin/sigs/leaders/batch { assignments: [{ sig, leaders, mode }],
// dryRun? }: every assignment is checked before anything changes.
export const batchLeaders: RequestHandler = async (req, res) => {
  try {
    const body = bodyWith(req, ["assignments", "dryRun"]);
    const dryRun = dryRunOf(body);
    const { assignments } = body;
    if (
      !Array.isArray(assignments) ||
      assignments.length < 1 ||
      assignments.length > MAX_ASSIGNMENTS
    )
      fail(
        CustomStatus.INVALID_BODY,
        `assignments must be 1 to ${MAX_ASSIGNMENTS} items`,
      );

    const seen = new Set<string>();
    const checked: LeaderAssignment[] = [];
    for (const [index, item] of assignments.entries()) {
      const where = `assignments[${index}]`;
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some(
          (key) => !["sig", "leaders", "mode"].includes(key),
        )
      )
        fail(
          CustomStatus.INVALID_BODY,
          `${where} must be { sig, leaders, mode }`,
        );
      const { sig, leaders, mode } = item as Record<string, unknown>;
      if (mode !== "replace" && mode !== "add")
        fail(CustomStatus.INVALID_BODY, `${where}.mode must be replace or add`);
      if (
        !Array.isArray(leaders) ||
        leaders.length > MAX_LEADERS ||
        !leaders.every((id) => typeof id === "string" && isValidObjectId(id))
      )
        fail(
          CustomStatus.INVALID_BODY,
          `${where}.leaders must be at most ${MAX_LEADERS} user ids`,
        );
      if (typeof sig !== "string" || !isValidObjectId(sig))
        fail(CustomStatus.INVALID_BODY, `${where}.sig must be a SIG id`);
      if (seen.has(sig))
        fail(CustomStatus.INVALID_BODY, `${where}.sig is listed twice`);
      seen.add(sig);

      const sigData = await SigDB.read({ id: sig }).catch(() => null);
      if (!sigData)
        fail(CustomStatus.INVALID_SIG_ID, `${where}: SIG not found`);
      if (sigData.removed)
        fail(CustomStatus.INVALID_SIG_ID, `${where}: the SIG is archived`);
      checked.push({ sig: sigData, leaders: leaders as string[], mode });
    }

    const people = await AdminDB.usersByIds(
      checked.flatMap((item) => [
        ...item.leaders,
        ...(item.sig.leader ?? []).map(String),
      ]),
      { name: 1, customId: 1 },
    );
    checked.forEach((item, index) => {
      const unknown = item.leaders.filter((id) => !people.has(id));
      if (unknown.length > 0)
        fail(
          CustomStatus.INVALID_USER_ID,
          `assignments[${index}].leaders: no user ${unknown.join(", ")}`,
        );
    });

    const person = (id: string) => ({
      _id: id,
      name: people.get(id)?.name ?? "",
      customId: people.get(id)?.customId ?? "",
    });
    const describe = (
      sigId: string,
      changes: { added: string[]; removed: string[]; leaders: string[] },
      applied: boolean,
    ) => ({
      sig: sigId,
      added: changes.added.map(person),
      removed: changes.removed.map(person),
      leaders: changes.leaders.map(person),
      applied,
    });

    if (dryRun) {
      const results = checked.map((item) =>
        describe(String(item.sig._id), leaderChanges(item), false),
      );
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: {
          dryRun,
          added: results.reduce((n, r) => n + r.added.length, 0),
          removed: results.reduce((n, r) => n + r.removed.length, 0),
          results,
        },
      });
    }

    const { result, transactional } = await runApply((session, progress) =>
      applyLeaders(checked, session, progress),
    );

    const actor = callerId(req);
    for (const item of result) {
      if (!item.applied) continue;
      for (const [ids, action] of [
        [item.added, "sig.leader.add"],
        [item.removed, "sig.leader.remove"],
      ] as const) {
        for (const id of ids) {
          await recordAudit({
            actor,
            action,
            target: { kind: "user", id, label: people.get(id)?.name ?? "" },
            meta: { sig: item.sig, batch: true },
          });
        }
      }
    }

    const applied = result.filter((item) => item.applied);
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        dryRun,
        added: applied.reduce((n, r) => n + r.added.length, 0),
        removed: applied.reduce((n, r) => n + r.removed.length, 0),
        results: result.map((item) => describe(item.sig, item, item.applied)),
        transactional,
      },
    });
  } catch (error) {
    return sendFailure(res, error);
  }
};
