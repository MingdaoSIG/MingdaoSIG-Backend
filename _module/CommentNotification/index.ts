import { isValidObjectId } from "mongoose";

import MongoDB from "@module/MongoDB";
import { SendText } from "@module/SendMail";

const UserDB = new MongoDB.User();

const EXCERPT_LENGTH = 100;

export type NewCommentEvent = {
  /** user id of whoever wrote the comment */
  actorId: string;
  actorName?: string;
  post: { _id: string; title?: string; user?: string };
  content: string;
  /** author of the comment that was replied to, for a reply */
  parentAuthorId?: string;
};

type Recipient = { id: string; repliedTo: boolean };

/**
 * Emails the people a new comment concerns: the post's author, and for a
 * reply the author of the comment replied to (one email each, even when they
 * are the same person). Nobody gets an email about their own comment, and
 * users who set `notifyComments` to false get none.
 *
 * Fire and forget: returns at once, never throws, and a failed email only
 * logs a warning (without any address).
 */
export default function notifyNewComment(event: NewCommentEvent): void {
  sendNotifications(event).catch((error) => {
    console.warn(
      "Comment saved, but the notification emails failed:",
      error instanceof Error ? error.message : error,
    );
  });
}

async function sendNotifications(event: NewCommentEvent) {
  const recipients = recipientsFor(event);
  if (recipients.length === 0) return;

  const users = await UserDB.list(
    { _id: { $in: recipients.map((recipient) => recipient.id) } },
    { lean: true, projection: { email: 1, notifyComments: 1 } },
  );
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const user = usersById.get(recipient.id);
      const email = user?.email?.trim();
      // A missing setting means the default: on.
      if (!email || user?.notifyComments === false) return;

      const { title, message } = composeEmail(event, recipient);
      await SendText(title, message, [email]);
    }),
  );

  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.warn(
      `Comment saved, but ${failed.length} of ${recipients.length} notification emails failed`,
    );
  }
}

function recipientsFor(event: NewCommentEvent): Recipient[] {
  const recipients = new Map<string, Recipient>();
  const add = (id: string | undefined, repliedTo: boolean) => {
    if (!id || id === event.actorId || !isValidObjectId(id)) return;
    const existing = recipients.get(id);
    recipients.set(id, {
      id,
      repliedTo: repliedTo || Boolean(existing?.repliedTo),
    });
  };

  add(event.parentAuthorId, true);
  add(event.post.user, false);
  return Array.from(recipients.values());
}

function composeEmail(event: NewCommentEvent, recipient: Recipient) {
  const who = event.actorName?.trim() || "有人";
  const postTitle = event.post.title?.trim() || "（無標題）";
  const isReply = Boolean(event.parentAuthorId);

  const title = recipient.repliedTo
    ? "SIG 平台：你的留言有新回覆"
    : "SIG 平台：你的貼文有新留言";
  const lead = recipient.repliedTo
    ? `${who} 回覆了你在貼文「${postTitle}」的留言：`
    : isReply
      ? `${who} 在你的貼文「${postTitle}」回覆了一則留言：`
      : `${who} 在你的貼文「${postTitle}」留言：`;

  const message = [
    lead,
    `「${excerpt(event.content)}」`,
    "",
    `查看貼文：${postUrl(event.post._id)}`,
    "",
    "不想再收到留言通知的話，可以到個人頁面關閉「有人留言時寄信通知我」。",
  ].join("\n");

  return { title, message };
}

// The first 100 characters (code points), on one line.
function excerpt(content: string) {
  const characters = Array.from(content.replace(/\s+/g, " ").trim());
  if (characters.length <= EXCERPT_LENGTH) return characters.join("");
  return `${characters.slice(0, EXCERPT_LENGTH).join("")}…`;
}

function postUrl(postId: string) {
  const base = (process.env.FRONTEND_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/post/${postId}`;
}
