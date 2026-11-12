import { Request, RequestHandler } from "express";

import { Sig } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin, isSigModerator } from "@module/Permission";
import { notify } from "@module/Notify";
import {
  createFeedback as insertFeedback,
  editFeedback as updateFeedback,
  FEEDBACK_MAX_LENGTH,
  FeedbackDoc,
  FeedbackModel,
  readFeedback,
  removeFeedback as softRemoveFeedback,
} from "@module/Feedback";
import {
  caller,
  callerId,
  exactBody,
  fail,
  pathId,
  sendError,
} from "@controller/cloud/admin/_shared";

// Teacher feedback (老師回饋, API contract v4 §3.2). Private to the post's
// author, the moderators (指導老師) of the post's SIG and admins. SIG leaders
// are not included.

const PostDB = new MongoDB.Post();
const SigDB = new MongoDB.Sig();
const AdminDB = new MongoDB.Admin();

const NOTIFY_EXCERPT_LENGTH = 100;

function checkContent(value: unknown) {
  if (typeof value !== "string")
    fail(CustomStatus.INVALID_BODY, "content must be a string");
  if (value.trim() === "") fail(CustomStatus.EMPTY_CONTENT, "content is empty");
  if (Array.from(value).length > FEEDBACK_MAX_LENGTH)
    fail(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `content is longer than ${FEEDBACK_MAX_LENGTH} characters`,
    );
  return value;
}

/** The non-removed post and its SIG; 404/4000 when the post is missing. */
async function readPostAndSig(postId: string) {
  const post = await PostDB.read(
    { id: postId },
    { lean: true, projection: { user: 1, sig: 1, title: 1 } },
  ).catch(() => null);
  if (!post) fail(CustomStatus.NOT_FOUND, "Post not found");
  const sig = (await SigDB.read({ id: post.sig }).catch(
    () => null,
  )) as Sig | null;
  return { post, sig };
}

function isTeacherOf(req: Request, sig: Sig | null) {
  return Boolean(sig && isSigModerator(sig, callerId(req)));
}

async function formatFeedback(entries: FeedbackDoc[]) {
  const authors = await AdminDB.usersByIds(
    entries.map((entry) => entry.author),
    { name: 1, customId: 1, avatar: 1 },
  );
  return entries.map((entry) => {
    const author = authors.get(String(entry.author));
    return {
      _id: String(entry._id),
      content: entry.content,
      author: {
        _id: String(entry.author),
        name: author?.name ?? "",
        customId: author?.customId ?? "",
        avatar: author?.avatar ?? "",
      },
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  });
}

// POST /post/:id/feedback { content }: a moderator of the post's SIG or an
// admin. Notifies the post's author.
export const createFeedback: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const postId = pathId(req, "id");
    const content = checkContent(exactBody(req, ["content"]).content);
    const { post, sig } = await readPostAndSig(postId);
    if (!isAdmin(caller(req)) && !isTeacherOf(req, sig))
      fail(CustomStatus.FORBIDDEN, "Only the sig's moderators or an admin");

    const actor = callerId(req);
    const saved = await insertFeedback(postId, actor, content);
    await notify({
      recipient: String(post.user),
      type: "feedback",
      actor,
      target: { kind: "post", id: postId, label: post.title ?? "" },
      link: `/post/${postId}#feedback`,
      meta: {
        feedback: String(saved._id),
        excerpt: Array.from(content.trim())
          .slice(0, NOTIFY_EXCERPT_LENGTH)
          .join(""),
      },
    });

    const [data] = await formatFeedback([saved]);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /post/:id/feedback: the post's author, the SIG's moderators and admins.
export const listFeedback: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const postId = pathId(req, "id");
    const { post, sig } = await readPostAndSig(postId);
    const isAuthor = String(post.user) === callerId(req);
    if (!isAuthor && !isAdmin(caller(req)) && !isTeacherOf(req, sig))
      fail(CustomStatus.FORBIDDEN, "Not allowed to read this feedback");

    const entries = (await FeedbackModel.find({ post: postId, removed: false })
      .sort({ createdAt: 1, _id: 1 })
      .lean()) as FeedbackDoc[];
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await formatFeedback(entries),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /feedback/:id { content }: the feedback's author only.
export const editFeedback: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const id = pathId(req, "id");
    const content = checkContent(exactBody(req, ["content"]).content);
    const entry = await readFeedback(id);
    if (!entry) fail(CustomStatus.NOT_FOUND, "Feedback not found");
    if (String(entry.author) !== callerId(req))
      fail(CustomStatus.FORBIDDEN, "Not the author of this feedback");

    const updated = await updateFeedback(id, content);
    if (!updated) fail(CustomStatus.NOT_FOUND, "Feedback not found");
    const [data] = await formatFeedback([updated]);
    return res.status(HttpStatus.OK).json({ status: CustomStatus.OK, data });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /feedback/:id: the feedback's author or an admin (soft delete).
export const removeFeedback: RequestHandler<Record<string, string>> = async (
  req,
  res,
) => {
  try {
    const id = pathId(req, "id");
    const entry = await readFeedback(id);
    if (!entry) fail(CustomStatus.NOT_FOUND, "Feedback not found");
    if (String(entry.author) !== callerId(req) && !isAdmin(caller(req)))
      fail(CustomStatus.FORBIDDEN, "Not the author of this feedback");

    const removed = await softRemoveFeedback(id);
    if (!removed) fail(CustomStatus.NOT_FOUND, "Feedback not found");
    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: { _id: id, removed: true },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
