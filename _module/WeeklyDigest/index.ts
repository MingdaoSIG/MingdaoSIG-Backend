import { isValidObjectId } from "mongoose";

import { User } from "@type/user";
import userModel from "@schema/user";
import MongoDB from "@module/MongoDB";
import { isShuttingDown } from "@module/GracefulShutdown";
import { resolveNotificationSettings } from "@module/NotificationSettings";
import { SendText } from "@module/SendMail";
import { userSigIds } from "@module/UserSigs";

/**
 * Weekly digest email (contract v4 §2.6).
 *
 * - Opt-in: only users with `notificationSettings.email.digest === true`.
 * - An in-process scheduler checks every 10 minutes and sends on Mondays
 *   from 08:00 Asia/Taipei (the backend runs one replica).
 * - Sent to users with at least one new post in their SIGs (member, leader
 *   or moderator) in the past 7 days: up to 10 post titles with SIG names
 *   and links, and how to turn the digest off.
 * - Idempotent per ISO week: `user.digestLastSentWeek` is claimed
 *   atomically before sending and put back when the mail API refuses.
 * - At most one email per second through SendText (the school's mail API);
 *   after 3 failures in a row the run stops and the next one waits an hour.
 * - Logs counts only, never addresses.
 */

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
// The first check after a (re)start, so a deploy on Monday morning does not
// wait a full interval.
const FIRST_CHECK_DELAY_MS = 60 * 1000;
const SEND_INTERVAL_MS = 1000;
// A mail request that hangs this long counts as failed but keeps the claim:
// it may have been delivered, and a second copy is worse than none.
const SEND_TIMEOUT_MS = 30 * 1000;
const MAX_FAILURES_IN_A_ROW = 3;
const BACKOFF_AFTER_ABORT_MS = 60 * 60 * 1000;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no daylight saving
const SEND_FROM_HOUR = 8;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const DIGEST_MAX_POSTS = 10;
const TITLE_LENGTH = 100;

/** The ISO week of `now` in Asia/Taipei, e.g. "2026-W46". */
export function isoWeek(now: Date) {
  const taipei = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  const date = new Date(
    Date.UTC(
      taipei.getUTCFullYear(),
      taipei.getUTCMonth(),
      taipei.getUTCDate(),
    ),
  );
  // The Thursday of this week decides the year.
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday, from 08:00 to midnight Asia/Taipei. */
export function isDigestDue(now: Date) {
  const taipei = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  return taipei.getUTCDay() === 1 && taipei.getUTCHours() >= SEND_FROM_HOUR;
}

type DigestUser = Pick<User, "_id" | "name" | "customId" | "sig">;

export type Digest = {
  title: string;
  text: string;
  /** new posts in the user's SIGs in the past 7 days */
  posts: number;
};

/** The digest email for one user at `now` (nothing is sent). */
export async function composeDigest(
  user: DigestUser,
  now = new Date(),
): Promise<Digest> {
  const sigIds = await userSigIds(String(user._id), user.sig ?? []);
  const filter = {
    sig: { $in: sigIds },
    removed: false,
    createdAt: { $gte: new Date(now.getTime() - WINDOW_MS), $lte: now },
  };
  const [posts, total] =
    sigIds.length === 0
      ? [[], 0]
      : await Promise.all([
          PostDB.list(filter, {
            limit: DIGEST_MAX_POSTS,
            sort: { createdAt: -1, _id: -1 },
            projection: { title: 1, sig: 1, createdAt: 1 },
          }),
          PostDB.count(filter),
        ]);

  const sigNames = await namesOf(posts.map((post) => post.sig));
  const base = frontendBase();
  const greeting = user.name?.trim() ? `${user.name.trim()} 你好：` : "你好：";

  const lines =
    total === 0
      ? [greeting, "", "過去 7 天，你的 SIG 沒有新貼文，這週不會寄出摘要。"]
      : [
          greeting,
          "",
          `過去 7 天，你的 SIG 有 ${total} 篇新貼文${
            total > posts.length ? `，以下是最新的 ${posts.length} 篇` : ""
          }：`,
          "",
          ...posts.flatMap((post, index) => [
            `${index + 1}. 【${sigNames.get(String(post.sig)) || "SIG"}】${title(
              post.title,
            )}`,
            `   ${base}/post/${post._id}`,
          ]),
          ...(total > posts.length
            ? ["", `其餘的貼文可以到首頁的「我的 SIG」查看：${base}/`]
            : []),
        ];

  lines.push(
    "",
    "——",
    "這是你訂閱的 MDSIG 每週摘要，每週一早上寄出。",
    `不想再收到的話，到個人頁面的通知設定關閉「每週摘要」即可${
      user.customId ? `：${base}/@${user.customId}` : "。"
    }`,
  );

  return {
    title: `MDSIG 每週摘要：你的 SIG 有 ${total} 篇新貼文`,
    text: lines.join("\n"),
    posts: total,
  };
}

export type DigestRunResult = {
  week: string;
  /** opted-in users not sent this week yet */
  candidates: number;
  sent: number;
  failed: number;
  /** no new posts in their SIGs, or no email address */
  skipped: number;
  /** stopped early: shutdown, or too many failures in a row */
  aborted: boolean;
};

let currentRun: Promise<DigestRunResult> | null = null;
let stopping = false;
let wakeSleeper: (() => void) | null = null;

/**
 * Sends this week's digest to every opted-in user who has not had it yet.
 * Exported so tests can run it on demand; the scheduler calls it on Mondays.
 * A second call while one runs returns the running one.
 */
export function runWeeklyDigest(
  option: { now?: Date; sendIntervalMs?: number } = {},
) {
  if (!currentRun) {
    currentRun = sendDigests(option).finally(() => {
      currentRun = null;
    });
  }
  return currentRun;
}

async function sendDigests(option: {
  now?: Date;
  sendIntervalMs?: number;
}): Promise<DigestRunResult> {
  const now = option.now ?? new Date();
  const sendIntervalMs = option.sendIntervalMs ?? SEND_INTERVAL_MS;
  const week = isoWeek(now);

  const users = (await userModel
    .find(
      {
        "notificationSettings.email.digest": true,
        digestLastSentWeek: { $ne: week },
      },
      { name: 1, customId: 1, sig: 1, email: 1 },
    )
    .sort({ _id: 1 })
    .lean()) as unknown as (DigestUser & { email?: string })[];

  const result: DigestRunResult = {
    week,
    candidates: users.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    aborted: false,
  };
  let failuresInARow = 0;
  let lastSendAt = 0;

  for (const user of users) {
    if (stopping || isShuttingDown()) {
      result.aborted = true;
      break;
    }
    const email = user.email?.trim();
    if (!email) {
      result.skipped++;
      continue;
    }

    const digest = await composeDigest(user, now);
    if (digest.posts === 0) {
      result.skipped++;
      continue;
    }

    // Claim the week first: a second run (or replica) skips this user.
    const before = await userModel
      .findOneAndUpdate(
        {
          _id: user._id,
          "notificationSettings.email.digest": true,
          digestLastSentWeek: { $ne: week },
        },
        { $set: { digestLastSentWeek: week } },
        { projection: { digestLastSentWeek: 1 }, timestamps: false },
      )
      .lean();
    if (!before) continue;

    await sleep(lastSendAt + sendIntervalMs - Date.now());
    if (stopping || isShuttingDown()) {
      await releaseClaim(String(user._id), week, before.digestLastSentWeek);
      result.aborted = true;
      break;
    }
    lastSendAt = Date.now();

    const outcome = await sendWithTimeout(digest, email);
    if (outcome === "sent") {
      result.sent++;
      failuresInARow = 0;
      continue;
    }

    result.failed++;
    failuresInARow++;
    if (outcome === "refused") {
      await releaseClaim(String(user._id), week, before.digestLastSentWeek);
    }
    if (failuresInARow >= MAX_FAILURES_IN_A_ROW) {
      result.aborted = true;
      break;
    }
  }

  // Nothing to report on the quiet checks after this week's emails are out.
  if (result.sent > 0 || result.failed > 0 || result.aborted) {
    console.log(
      `Digest : ${week}: ${result.sent} sent, ${result.failed} failed, ${
        result.skipped
      } skipped of ${result.candidates}${result.aborted ? " (stopped early)" : ""}`,
    );
  }
  return result;
}

async function sendWithTimeout(digest: Digest, email: string) {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), SEND_TIMEOUT_MS);
  });
  const sending = SendText(digest.title, digest.text, [email]).then(
    () => "sent" as const,
    () => "refused" as const,
  );
  const outcome = await Promise.race([sending, timedOut]);
  clearTimeout(timer);
  return outcome;
}

// The mail API refused: let the next run try this user again.
async function releaseClaim(
  userId: string,
  week: string,
  previous: string | null | undefined,
) {
  await userModel
    .updateOne(
      { _id: userId, digestLastSentWeek: week },
      previous
        ? { $set: { digestLastSentWeek: previous } }
        : { $unset: { digestLastSentWeek: 1 } },
      { timestamps: false },
    )
    .catch((error: any) =>
      console.error(`Digest : could not release a claim: ${error?.message}`),
    );
}

let checkTimer: NodeJS.Timeout | null = null;
let firstCheckTimer: NodeJS.Timeout | null = null;
let notBefore = 0;

/** Starts the in-process scheduler (once). */
export function startDigestScheduler() {
  if (checkTimer) return;
  stopping = false;
  checkTimer = setInterval(check, CHECK_INTERVAL_MS);
  checkTimer.unref();
  firstCheckTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
  firstCheckTimer.unref();
  console.log(
    "Digest : scheduler started (checks every 10 min, Mondays from 08:00 Asia/Taipei)",
  );
}

/** Stops the scheduler and waits for a running digest to stop. */
export async function stopDigestScheduler() {
  if (!checkTimer && !currentRun) return;
  stopping = true;
  if (checkTimer) clearInterval(checkTimer);
  if (firstCheckTimer) clearTimeout(firstCheckTimer);
  checkTimer = null;
  firstCheckTimer = null;
  wakeSleeper?.();
  await currentRun?.catch(() => undefined);
  console.warn("Digest : scheduler stopped");
}

function check() {
  const now = new Date();
  if (stopping || isShuttingDown() || now.getTime() < notBefore) return;
  if (!isDigestDue(now)) return;

  runWeeklyDigest({ now })
    .then((result) => {
      if (result.aborted && !stopping && !isShuttingDown()) {
        notBefore = Date.now() + BACKOFF_AFTER_ABORT_MS;
      }
    })
    .catch((error) => {
      console.error(
        "Digest : run failed:",
        error instanceof Error ? error.message : error,
      );
    });
}

/** Whether the user receives the digest (the preview reports it). */
export function digestEnabled(
  user: Parameters<typeof resolveNotificationSettings>[0],
) {
  return resolveNotificationSettings(user).email.digest;
}

async function namesOf(sigIds: string[]) {
  const ids = Array.from(new Set(sigIds.map(String))).filter((id) =>
    isValidObjectId(id),
  );
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const sigs = await SigDB.list(
    { _id: { $in: ids } },
    { lean: true, projection: { name: 1 } },
  );
  for (const sig of sigs) names.set(String(sig._id), sig.name ?? "");
  return names;
}

function title(text: string | undefined) {
  const characters = Array.from(
    String(text ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (characters.length === 0) return "（無標題）";
  if (characters.length <= TITLE_LENGTH) return characters.join("");
  return `${characters.slice(0, TITLE_LENGTH - 1).join("")}…`;
}

function frontendBase() {
  return (process.env.FRONTEND_BASE_URL ?? "").replace(/\/+$/, "");
}

// Resolves early when the scheduler stops.
function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      wakeSleeper = null;
      resolve();
    }
    wakeSleeper = done;
  });
}
