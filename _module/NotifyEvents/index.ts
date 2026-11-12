import { isValidObjectId } from "mongoose";

import MongoDB from "@module/MongoDB";
import { notify, NotifyInput } from "@module/Notify";
import { ADMIN_PERMISSION } from "@module/Permission";

/**
 * The notification triggers of contract v4 §1 owned by BE-N: comment, reply,
 * like, join_request and join_result. Each is fire and forget: it returns at
 * once, never throws, and a failure is only logged (notify() never throws
 * either). Notifying yourself is skipped by notify().
 */

const UserDB = new MongoDB.User();
const SigDB = new MongoDB.Sig();

// Comment excerpt shown in the notification (and as the push body).
const EXCERPT_LENGTH = 100;

function run(name: string, task: () => Promise<unknown>) {
  task().catch((error) => {
    console.error(
      `Notify : ${name} trigger failed:`,
      error instanceof Error ? error.message : error,
    );
  });
}

function postLink(postId: string) {
  return `/post/${postId}`;
}

/**
 * A new comment: the post author gets `comment`. For a reply, the author of
 * the comment replied to gets `reply`, and the post author (when that is
 * someone else) still gets `comment`.
 */
export function notifyComment(event: {
  actorId: string;
  post: { _id: string; title?: string; user?: string };
  commentId: string;
  content: string;
  /** author of the comment replied to, for a reply */
  parentAuthorId?: string;
}) {
  run("comment", async () => {
    const postId = String(event.post._id);
    const base = {
      actor: event.actorId,
      target: { kind: "post", id: postId, label: event.post.title ?? "" },
      link: postLink(postId),
      meta: {
        comment: String(event.commentId),
        excerpt: excerpt(event.content),
      },
    } as const;

    const inputs: NotifyInput[] = [];
    const parent = event.parentAuthorId;
    if (parent) inputs.push({ ...base, recipient: parent, type: "reply" });
    if (event.post.user && event.post.user !== parent)
      inputs.push({ ...base, recipient: event.post.user, type: "comment" });
    await notify(inputs);
  });
}

/** A new like on a post: the author gets `like`, collapsed per post. */
export function notifyLike(event: {
  actorId: string;
  post: { _id: string; title?: string; user?: string };
}) {
  run("like", async () => {
    if (!event.post.user) return;
    const postId = String(event.post._id);
    await notify({
      recipient: event.post.user,
      type: "like",
      actor: event.actorId,
      target: { kind: "post", id: postId, label: event.post.title ?? "" },
      link: postLink(postId),
      collapseKey: `like:${postId}`,
    });
  });
}

/**
 * A new join request: every manager of the SIG (leaders and moderators) gets
 * `join_request`, collapsed per SIG. A SIG without a manager other than the
 * applicant notifies the platform admins instead, like the request email.
 */
export function notifyJoinRequest(event: {
  actorId: string;
  sigId: string;
  requestId: string;
}) {
  run("join_request", async () => {
    const sig = await SigDB.read({ id: event.sigId }).catch(() => null);
    if (!sig) return;

    const recipients = await reviewerIds(
      [...(sig.leader ?? []), ...(sig.moderator ?? [])],
      event.actorId,
    );
    await notify(
      recipients.map((recipient) => ({
        recipient,
        type: "join_request",
        actor: event.actorId,
        // Collapsed per SIG, so the target is the SIG's request list.
        target: { kind: "join", id: event.sigId, label: sig.name ?? "" },
        link: `/admin/join-requests?sig=${event.sigId}`,
        meta: { sig: event.sigId, request: String(event.requestId) },
        collapseKey: `join:${event.sigId}`,
      })),
    );
  });
}

/**
 * A join request was decided (email link or admin panel): the applicant gets
 * `join_result`. There is no actor: the email link does not say who clicked
 * it, and an applicant is told the SIG's decision, not who made it.
 */
export function notifyJoinResult(event: {
  applicantId: string;
  sigId: string;
  accepted: boolean;
}) {
  run("join_result", async () => {
    const sig = await SigDB.read({ id: event.sigId }).catch(() => null);
    await notify({
      recipient: event.applicantId,
      type: "join_result",
      actor: null,
      target: { kind: "sig", id: event.sigId, label: sig?.name ?? "" },
      link: sig?.customId ? `/@${sig.customId}` : "/",
      meta: { accepted: event.accepted },
    });
  });
}

/**
 * The managers that still have an account, without the applicant; when none
 * is left, the admins (without the applicant).
 */
async function reviewerIds(managerIds: string[], applicantId: string) {
  const candidates = Array.from(new Set(managerIds)).filter(
    (id) => id !== applicantId && isValidObjectId(id),
  );
  const managers =
    candidates.length > 0
      ? await UserDB.list(
          { _id: { $in: candidates } },
          { lean: true, projection: { _id: 1 } },
        )
      : [];
  if (managers.length > 0) return managers.map((user) => String(user._id));

  const admins = await UserDB.list(
    { permission: ADMIN_PERMISSION },
    { lean: true, projection: { _id: 1 } },
  );
  return admins
    .map((user) => String(user._id))
    .filter((id) => id !== applicantId);
}

// At most 100 characters (code points, "…" included), on one line.
function excerpt(content: string) {
  const characters = Array.from(String(content).replace(/\s+/g, " ").trim());
  if (characters.length <= EXCERPT_LENGTH) return characters.join("");
  return `${characters.slice(0, EXCERPT_LENGTH - 1).join("")}…`;
}
