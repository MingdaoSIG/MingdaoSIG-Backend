import axios from "axios";
import { isValidObjectId } from "mongoose";

import sig from "@schema/sig";
import PlainTextExcerpt from "@module/PlainTextExcerpt";

/**
 * Discord announcements for a SIG (API contract v4 §3.6).
 *
 * The webhook URL is a secret (anyone holding it can post to the channel):
 * the schema never selects it unless asked for, and nothing here logs it.
 * Failures are logged with the SIG or post id and the HTTP status only.
 */

export const DISCORD_WEBHOOK_PATTERN =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
// Real webhook URLs are about 120 characters.
const MAX_URL_LENGTH = 300;
const TIMEOUT_MS = 5000;
const EMBED_COLOR = 0x0b5a83;
const EMBED_TITLE_MAX = 256;
const EMBED_AUTHOR_MAX = 256;
// PlainTextExcerpt adds "…" after the cut, so the description stays ≤200.
const EMBED_DESCRIPTION_CUT = 199;

export function isValidDiscordWebhook(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_URL_LENGTH &&
    DISCORD_WEBHOOK_PATTERN.test(value)
  );
}

/** The ids (of `sigIds`) whose SIG has a webhook set. The URL is not read. */
export async function sigIdsWithDiscordWebhook(sigIds: string[]) {
  const ids = sigIds.filter((id) => isValidObjectId(id));
  if (ids.length === 0) return new Set<string>();
  const docs = await sig
    .find(
      {
        _id: { $in: ids },
        discordWebhook: { $exists: true, $nin: [null, ""] },
      },
      { _id: 1 },
    )
    .lean();
  return new Set(docs.map((doc) => String(doc._id)));
}

async function webhookOf(sigId: string): Promise<string | null> {
  if (!isValidObjectId(sigId)) return null;
  const doc: any = await sig.findById(sigId).select("+discordWebhook").lean();
  const url = doc?.discordWebhook;
  return isValidDiscordWebhook(url) ? url : null;
}

/**
 * POSTs `payload` to the webhook. Resolves to the HTTP status, or to a short
 * reason ("timeout", "network") when there is no response. Never throws.
 */
async function send(url: string, payload: object): Promise<number | string> {
  try {
    const response = await axios.post(url, payload, {
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { "Content-Type": "application/json" },
    });
    return response.status;
  } catch (error: any) {
    // Never log the error itself: it carries the request URL.
    const code = String(error?.code ?? "");
    return code === "ECONNABORTED" ||
      code === "ETIMEDOUT" ||
      code === "ERR_CANCELED" ||
      error?.name === "TimeoutError" ||
      error?.name === "CanceledError"
      ? "timeout"
      : "network";
  }
}

const isOk = (result: number | string) =>
  typeof result === "number" && result >= 200 && result < 300;

function coverUrl(cover: unknown, apiBaseUrl: string) {
  if (typeof cover !== "string" || cover === "") return null;
  if (/^https?:\/\//i.test(cover)) return cover;
  if (isValidObjectId(cover) && apiBaseUrl)
    return `${apiBaseUrl}/image/${cover}`;
  return null;
}

export type NewPostAnnouncement = {
  post: {
    _id?: unknown;
    sig: string;
    title?: string;
    content?: string;
    cover?: string;
  };
  authorName: string;
  /** Public base URL of this API, for the cover image (`/image/:id`). */
  apiBaseUrl: string;
};

/** The webhook body for a new post: one embed. */
export function newPostPayload({
  post,
  authorName,
  apiBaseUrl,
}: NewPostAnnouncement) {
  const frontend = (process.env.FRONTEND_BASE_URL ?? "").replace(/\/+$/, "");
  const image = coverUrl(post.cover, apiBaseUrl.replace(/\/+$/, ""));
  const title =
    Array.from((post.title ?? "").trim())
      .slice(0, EMBED_TITLE_MAX)
      .join("") || "（無標題）";
  const author = Array.from(authorName.trim())
    .slice(0, EMBED_AUTHOR_MAX)
    .join("");

  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title,
        ...(frontend ? { url: `${frontend}/post/${String(post._id)}` } : {}),
        description: PlainTextExcerpt(post.content, EMBED_DESCRIPTION_CUT),
        ...(author ? { author: { name: author } } : {}),
        ...(image ? { image: { url: image } } : {}),
        color: EMBED_COLOR,
      },
    ],
  };
}

/**
 * Announces a new post to its SIG's webhook, if one is set. Fire and forget:
 * returns at once, never throws, and never delays or fails the post.
 */
export function announceNewPost(announcement: NewPostAnnouncement) {
  const postId = String(announcement.post._id);
  void (async () => {
    const url = await webhookOf(announcement.post.sig);
    if (!url) return;
    const result = await send(url, newPostPayload(announcement));
    if (!isOk(result)) {
      console.warn(
        `Discord : announcement for post ${postId} failed (${result})`,
      );
    }
  })().catch((error) => {
    console.warn(
      `Discord : announcement for post ${postId} failed:`,
      error instanceof Error ? error.name : "error",
    );
  });
}

/**
 * Sends a test message to the SIG's webhook (POST /sig/:id/discord/test).
 * Resolves to false when no webhook is set or Discord did not accept it.
 */
export async function sendDiscordTest(sigId: string, sigName: string) {
  const url = await webhookOf(sigId);
  if (!url) return false;
  const result = await send(url, {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "MDSIG Discord 通知測試",
        description: `這個頻道之後會收到「${sigName}」的新貼文通知。`,
        color: EMBED_COLOR,
      },
    ],
  });
  if (!isOk(result))
    console.warn(`Discord : test message for sig ${sigId} failed (${result})`);
  return isOk(result);
}
