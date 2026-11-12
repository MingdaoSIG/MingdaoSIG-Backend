import { ClientSession } from "mongoose";

import post from "@schema/post";
import user from "@schema/user";
import sig from "@schema/sig";
import joinRequest from "@schema/joinRequest";
import { sigDefaultCover } from "@module/SigDefaults";
import { sessionOption } from "@module/Transaction";

/**
 * Bulk SIG operations of the admin panel (API contract v4 §5.7): moving
 * posts, merging SIGs, the year rollover and batch leader changes.
 *
 * Every operation has a plan (counts only, changes nothing; the dry run) and
 * an apply step that takes an optional transaction session. Without a
 * transaction (a standalone MongoDB) the writes are ordered so that running
 * the same operation again after a failure finishes the job: each step only
 * touches what is still left to do, and the merge archives its source last.
 * `progress` records what each step changed, for the error response.
 */

type Session = ClientSession | null;
type Progress = Record<string, number>;

/** What a SIG is called in the responses. */
export function sigSummary(doc: any) {
  return {
    _id: String(doc._id),
    name: doc.name ?? "",
    customId: doc.customId ?? "",
  };
}

// A post cover stored as the image id or as a full ".../image/<id>" URL.
function coverPattern(imageId: string) {
  return { $regex: `^(.*/)?${imageId}$` };
}

// ---- Moving posts ------------------------------------------------------------

export type PostSelection = { ids: string[] } | { fromSig: string };

function selectionFilter(selection: PostSelection, toSig: string) {
  return "ids" in selection
    ? { _id: { $in: selection.ids }, sig: { $ne: toSig } }
    : { sig: selection.fromSig };
}

// Source SIG ids of the selected posts, and each one's default cover.
async function sourceCovers(filter: object, session: Session) {
  const ids: string[] = (
    await post.distinct("sig", filter).session(session ?? null)
  )
    .filter((id) => id !== null && id !== undefined)
    .map(String);
  const docs = await sig
    .find(
      { _id: { $in: ids.filter((id) => /^[0-9a-f]{24}$/i.test(id)) } },
      { defaultCover: 1 },
    )
    .session(session ?? null)
    .lean();
  const covers = new Map(
    docs.map((doc) => [String(doc._id), sigDefaultCover(doc)]),
  );
  return ids.map((id) => ({
    sig: id,
    cover: covers.get(id) || sigDefaultCover({ _id: id }),
  }));
}

/**
 * What moving the selected posts to `toSig` would do: `count` posts, of
 * which `covers` still show their old SIG's default cover (they get the
 * target's). `from` is the selected SIG, or the SIGs the listed posts are in.
 */
export async function planPostMove(selection: PostSelection, toSig: any) {
  const to = String(toSig._id);
  const filter = selectionFilter(selection, to);
  const targetCover = sigDefaultCover(toSig);
  const sources = await sourceCovers(filter, null);

  const [count, coverCounts] = await Promise.all([
    post.countDocuments(filter),
    Promise.all(
      sources.map(({ sig: from, cover }) =>
        cover && targetCover && cover !== targetCover
          ? post.countDocuments({
              ...filter,
              sig: from,
              cover: coverPattern(cover),
            })
          : 0,
      ),
    ),
  ]);

  return {
    count,
    covers: coverCounts.reduce((sum, n) => sum + n, 0),
    from:
      "fromSig" in selection
        ? selection.fromSig
        : sources.map((source) => source.sig).sort(),
  };
}

/**
 * Moves the selected posts to `toSig`. A post whose cover is its old SIG's
 * default cover gets the target's. Not an edit: `updatedAt` stays.
 */
export async function movePosts(
  selection: PostSelection,
  toSig: any,
  session: Session,
  progress: Progress = {},
) {
  const to = String(toSig._id);
  const filter = selectionFilter(selection, to);
  const targetCover = sigDefaultCover(toSig);
  const options = { ...sessionOption(session), timestamps: false };
  const sources = await sourceCovers(filter, session);

  progress.covers = 0;
  progress.posts = 0;
  for (const { sig: from, cover } of sources) {
    if (cover && targetCover && cover !== targetCover) {
      const result = await post.updateMany(
        { ...filter, sig: from, cover: coverPattern(cover) },
        { $set: { sig: to, cover: targetCover } },
        options,
      );
      progress.covers += result.modifiedCount;
      progress.posts += result.modifiedCount;
    }
  }
  const rest = await post.updateMany(filter, { $set: { sig: to } }, options);
  progress.posts += rest.modifiedCount;

  return {
    count: progress.posts,
    covers: progress.covers,
    from:
      "fromSig" in selection
        ? selection.fromSig
        : sources.map((source) => source.sig).sort(),
  };
}

// ---- Merging SIGs --------------------------------------------------------------

export const MERGE_NOTE_PREFIX = "SIG 已合併到";

// Pending requests to the source whose applicant is (or will be) a member
// of the target, or already waits for the target: rejected, not moved.
async function joinRequestPlan(
  source: string,
  target: string,
  session: Session,
) {
  const pending = await joinRequest
    .find({ sig: source, state: "pending", removed: false }, { user: 1 })
    .session(session ?? null)
    .lean();
  const applicants = Array.from(new Set(pending.map((r) => String(r.user))));

  const [members, waiting] = await Promise.all([
    user
      .find(
        {
          _id: { $in: applicants.filter((id) => /^[0-9a-f]{24}$/i.test(id)) },
          sig: { $in: [source, target] },
        },
        { _id: 1 },
      )
      .session(session ?? null)
      .lean(),
    joinRequest
      .find(
        {
          sig: target,
          state: "pending",
          removed: false,
          user: { $in: applicants },
        },
        { user: 1 },
      )
      .session(session ?? null)
      .lean(),
  ]);
  const duplicate = new Set([
    ...members.map((doc) => String(doc._id)),
    ...waiting.map((doc) => String(doc.user)),
  ]);

  const reject = pending.filter((r) => duplicate.has(String(r.user)));
  return {
    rejectIds: reject.map((r) => r._id),
    moved: pending.length - reject.length,
    rejected: reject.length,
  };
}

// Old ids of the source that should redirect to the target.
function redirectIds(source: any, target: any) {
  return Array.from(
    new Set(
      [source.customId, ...(source.previousCustomIds ?? [])].filter(
        (id): id is string => Boolean(id) && id !== target.customId,
      ),
    ),
  );
}

async function managersOf(source: any) {
  const ids = [...(source.leader ?? []), ...(source.moderator ?? [])].filter(
    (id: string) => /^[0-9a-f]{24}$/i.test(String(id)),
  );
  const people = new Map(
    (
      await user.find({ _id: { $in: ids } }, { name: 1, customId: 1 }).lean()
    ).map((doc) => [String(doc._id), doc]),
  );
  const list = (role: string[] | undefined) =>
    Array.from(new Set((role ?? []).map(String))).map((id) => ({
      _id: id,
      name: people.get(id)?.name ?? "",
      customId: people.get(id)?.customId ?? "",
    }));
  return { leaders: list(source.leader), moderators: list(source.moderator) };
}

/** Counts of merging `source` into `target`, changing nothing. */
export async function planMerge(source: any, target: any) {
  const from = String(source._id);
  const to = String(target._id);
  const [posts, membersAdded, membersAlready, requests, managers] =
    await Promise.all([
      planPostMove({ fromSig: from }, target),
      user.countDocuments({ $and: [{ sig: from }, { sig: { $ne: to } }] }),
      user.countDocuments({ sig: { $all: [from, to] } }),
      joinRequestPlan(from, to, null),
      managersOf(source),
    ]);
  return {
    posts: posts.count,
    covers: posts.covers,
    members: {
      added: membersAdded,
      alreadyInTarget: membersAlready,
      removedFromSource: membersAdded + membersAlready,
    },
    joinRequests: { moved: requests.moved, rejected: requests.rejected },
    previousCustomIds: redirectIds(source, target),
    ...managers,
  };
}

/**
 * Merges `source` into `target`, in this order: posts; members (target
 * added first, then the source taken out of `user.sig`); pending join
 * requests (moved, or rejected with a note when the applicant is already a
 * member of the target or waits for it); the source's customIds into the
 * target's `previousCustomIds`; and last, archiving the source. Leaders and
 * moderators are reported, not moved.
 */
export async function applyMerge(
  source: any,
  target: any,
  session: Session,
  progress: Progress = {},
) {
  const from = String(source._id);
  const to = String(target._id);
  const options = sessionOption(session);
  for (const key of Object.keys(progress)) delete progress[key];

  const posts = await movePosts({ fromSig: from }, target, session, progress);

  const already = await user
    .countDocuments({ sig: { $all: [from, to] } })
    .session(session ?? null);
  const added = await user.updateMany(
    { $and: [{ sig: from }, { sig: { $ne: to } }] },
    { $addToSet: { sig: to } },
    options,
  );
  progress.membersAdded = added.modifiedCount;
  const removed = await user.updateMany(
    { sig: from },
    { $pull: { sig: from } },
    options,
  );
  progress.membersRemovedFromSource = removed.modifiedCount;

  const requests = await joinRequestPlan(from, to, session);
  const rejected =
    requests.rejectIds.length > 0
      ? await joinRequest.updateMany(
          { _id: { $in: requests.rejectIds }, state: "pending" },
          {
            $set: {
              state: "rejected",
              note: `${MERGE_NOTE_PREFIX} ${target.name ?? ""}`.trim(),
            },
          },
          options,
        )
      : { modifiedCount: 0 };
  progress.joinRequestsRejected = rejected.modifiedCount;
  const moved = await joinRequest.updateMany(
    { sig: from, state: "pending", removed: false },
    { $set: { sig: to } },
    options,
  );
  progress.joinRequestsMoved = moved.modifiedCount;

  const previousCustomIds = redirectIds(source, target);
  if (previousCustomIds.length > 0)
    await sig.updateOne(
      { _id: to },
      { $addToSet: { previousCustomIds: { $each: previousCustomIds } } },
      options,
    );

  const archived = await sig.updateOne(
    { _id: from, removed: { $ne: true } },
    { $set: { removed: true } },
    options,
  );
  progress.archived = archived.modifiedCount;

  return {
    posts: posts.count,
    covers: posts.covers,
    members: {
      added: added.modifiedCount,
      alreadyInTarget: already,
      removedFromSource: removed.modifiedCount,
    },
    joinRequests: {
      moved: moved.modifiedCount,
      rejected: rejected.modifiedCount,
    },
    previousCustomIds,
    ...(await managersOf(source)),
  };
}

// ---- Year rollover -------------------------------------------------------------

/** `user.identity` of graduates (GetUserData maps the school's "alu"). */
export const ALUMNI_IDENTITY = "alumni";

const HAS_SIGS = { "sig.0": { $exists: true } };

/**
 * Alumni who are still SIG members (with counts per SIG), and the leaders
 * and moderators who are alumni.
 */
export async function rolloverPreview() {
  const [members, sigs] = await Promise.all([
    user
      .find(
        { identity: ALUMNI_IDENTITY, ...HAS_SIGS },
        { name: 1, customId: 1, class: 1, sig: 1 },
      )
      .sort({ _id: 1 })
      .lean(),
    sig
      .find({}, { name: 1, customId: 1, removed: 1, leader: 1, moderator: 1 })
      .sort({ _id: 1 })
      .lean(),
  ]);
  const sigById = new Map(sigs.map((doc) => [String(doc._id), doc]));

  const bySig = new Map<string, number>();
  let memberships = 0;
  const list = members.map((doc) => {
    const own = Array.from(new Set((doc.sig ?? []).map(String)));
    memberships += own.length;
    for (const id of own) bySig.set(id, (bySig.get(id) ?? 0) + 1);
    return {
      _id: String(doc._id),
      name: doc.name ?? "",
      customId: doc.customId ?? "",
      class: doc.class ?? "",
      sigs: own,
    };
  });

  const managers = await alumniManagers(sigs);

  return {
    alumniMembers: {
      users: list.length,
      memberships,
      bySig: Array.from(bySig, ([id, count]) => {
        const doc = sigById.get(id);
        return {
          sig: {
            _id: id,
            name: doc?.name ?? "",
            customId: doc?.customId ?? "",
            archived: Boolean(doc?.removed),
          },
          count,
        };
      }).sort(
        (a, b) => b.count - a.count || a.sig._id.localeCompare(b.sig._id),
      ),
      list,
    },
    alumniManagers: managers.map((item) => ({
      user: item.user,
      sig: sigSummary(item.sig),
      role: item.role,
    })),
  };
}

// (SIG, alumnus, role) for every alumni leader and moderator.
async function alumniManagers(sigs: any[], session: Session = null) {
  const ids = Array.from(
    new Set(
      sigs.flatMap((doc) => [...(doc.leader ?? []), ...(doc.moderator ?? [])]),
    ),
  )
    .map(String)
    .filter((id) => /^[0-9a-f]{24}$/i.test(id));
  const alumni = new Map(
    (
      await user
        .find(
          { _id: { $in: ids }, identity: ALUMNI_IDENTITY },
          { name: 1, customId: 1, class: 1 },
        )
        .session(session ?? null)
        .lean()
    ).map((doc) => [
      String(doc._id),
      {
        _id: String(doc._id),
        name: doc.name ?? "",
        customId: doc.customId ?? "",
        class: doc.class ?? "",
      },
    ]),
  );

  const result: { user: any; sig: any; role: "leader" | "moderator" }[] = [];
  for (const doc of sigs) {
    for (const role of ["leader", "moderator"] as const) {
      for (const id of new Set((doc[role] ?? []).map(String))) {
        const person = alumni.get(id as string);
        if (person) result.push({ user: person, sig: doc, role });
      }
    }
  }
  return result;
}

export type RolloverOptions = {
  removeAlumniFromSigs: boolean;
  removeAlumniLeaders: boolean;
};

/**
 * The year rollover. `removeAlumniFromSigs` empties the alumni's `user.sig`;
 * `removeAlumniLeaders` takes alumni out of every SIG's `leader` and
 * `moderator`. With `dryRun` it only counts.
 */
export async function applyRollover(
  options: RolloverOptions & { dryRun?: boolean },
  session: Session,
  progress: Progress = {},
) {
  const query = sessionOption(session);
  for (const key of Object.keys(progress)) delete progress[key];

  let users = 0;
  let memberships = 0;
  if (options.removeAlumniFromSigs) {
    const [counted] = await user
      .aggregate([
        { $match: { identity: ALUMNI_IDENTITY, ...HAS_SIGS } },
        {
          $group: {
            _id: null,
            users: { $sum: 1 },
            memberships: { $sum: { $size: { $setUnion: ["$sig", []] } } },
          },
        },
      ])
      .session(session ?? null);
    memberships = counted?.memberships ?? 0;
    if (options.dryRun) users = counted?.users ?? 0;
    else {
      const result = await user.updateMany(
        { identity: ALUMNI_IDENTITY, ...HAS_SIGS },
        { $set: { sig: [] } },
        query,
      );
      users = result.modifiedCount;
    }
  }
  progress.users = users;
  progress.memberships = memberships;

  const removedManagers: { sig: string; user: string; role: string }[] = [];
  progress.managers = 0;
  if (options.removeAlumniLeaders) {
    const sigs = await sig
      .find(
        {
          $or: [
            { "leader.0": { $exists: true } },
            { "moderator.0": { $exists: true } },
          ],
        },
        { name: 1, leader: 1, moderator: 1 },
      )
      .session(session ?? null)
      .lean();
    const managers = await alumniManagers(sigs, session);
    const bySig = new Map<string, { leader: string[]; moderator: string[] }>();
    for (const item of managers) {
      const id = String(item.sig._id);
      const entry = bySig.get(id) ?? { leader: [], moderator: [] };
      entry[item.role].push(item.user._id);
      bySig.set(id, entry);
    }
    for (const [id, entry] of bySig) {
      if (!options.dryRun)
        await sig.updateOne(
          { _id: id },
          {
            $pull: {
              leader: { $in: entry.leader },
              moderator: { $in: entry.moderator },
            },
          },
          query,
        );
      for (const role of ["leader", "moderator"] as const)
        for (const userId of entry[role])
          removedManagers.push({ sig: id, user: userId, role });
      progress.managers = removedManagers.length;
    }
  }

  return {
    users,
    memberships,
    leadersRemoved: removedManagers.filter((m) => m.role === "leader").length,
    moderatorsRemoved: removedManagers.filter((m) => m.role === "moderator")
      .length,
    managers: removedManagers,
  };
}

// ---- Batch leaders -------------------------------------------------------------

export type LeaderAssignment = {
  sig: any;
  leaders: string[];
  mode: "replace" | "add";
};

/** The leader changes of one assignment: who is added and who removed. */
export function leaderChanges(assignment: LeaderAssignment) {
  const current: string[] = Array.from(
    new Set((assignment.sig.leader ?? []).map(String)),
  );
  const wanted = Array.from(new Set(assignment.leaders));
  const added = wanted.filter((id) => !current.includes(id));
  const removed =
    assignment.mode === "replace"
      ? current.filter((id) => !wanted.includes(id))
      : [];
  const leaders =
    assignment.mode === "replace" ? wanted : [...current, ...added];
  return { added, removed, leaders };
}

/** Sets each SIG's leaders, as long as they did not change meanwhile. */
export async function applyLeaders(
  assignments: LeaderAssignment[],
  session: Session,
  progress: Progress = {},
) {
  const query = sessionOption(session);
  progress.sigs = 0;
  const results: {
    sig: string;
    added: string[];
    removed: string[];
    leaders: string[];
    applied: boolean;
  }[] = [];
  for (const assignment of assignments) {
    const id = String(assignment.sig._id);
    const changes = leaderChanges(assignment);
    let applied = true;
    if (changes.added.length > 0 || changes.removed.length > 0) {
      const stored = Array.from(assignment.sig.leader ?? [], String);
      const unchanged =
        stored.length > 0
          ? { leader: stored }
          : { $or: [{ leader: { $exists: false } }, { leader: [] }] };
      const result = await sig.updateOne(
        { _id: id, ...unchanged },
        { $set: { leader: changes.leaders } },
        query,
      );
      applied = result.modifiedCount > 0;
      if (applied) progress.sigs++;
    }
    results.push({ sig: id, ...changes, applied });
  }
  return results;
}
