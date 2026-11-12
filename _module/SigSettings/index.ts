import { isValidObjectId } from "mongoose";

import { JoinQuestion, Recruiting } from "@type/sig";
import { JoinAnswer } from "@type/joinRequest";
import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { sigColor, sigDefaultCover } from "@module/SigDefaults";

/**
 * Validation of the SIG fields set through `POST /sig/:id` and
 * `POST /admin/sigs`, the SIG shape the read routes return, and the join
 * questions and recruiting settings (API contract v3 §3.5, v4 §3.7, §5.6).
 */

export const SIG_NAME_MAX_LENGTH = 30;
export const SIG_DESCRIPTION_MAX_LENGTH = 250;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function invalid(status: number, message: string): never {
  throw new CustomError(status, new Error(message));
}

/** 1 to 30 characters after trimming. */
export function parseSigName(value: unknown) {
  if (typeof value !== "string")
    invalid(CustomStatus.INVALID_BODY, "name must be a string");
  const name = value.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > SIG_NAME_MAX_LENGTH)
    invalid(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `name must be 1 to ${SIG_NAME_MAX_LENGTH} characters`,
    );
  return name;
}

/** At most 250 characters. */
export function parseSigDescription(value: unknown) {
  if (typeof value !== "string")
    invalid(CustomStatus.INVALID_BODY, "description must be a string");
  if (value.length > SIG_DESCRIPTION_MAX_LENGTH)
    invalid(
      CustomStatus.INVALID_CONTENT_LENGTH,
      `description must be at most ${SIG_DESCRIPTION_MAX_LENGTH} characters`,
    );
  return value;
}

/** "#rrggbb", stored lowercased. */
export function parseSigColor(value: unknown) {
  if (typeof value !== "string" || !COLOR_PATTERN.test(value))
    invalid(CustomStatus.INVALID_BODY, "color must be #rrggbb");
  return value.toLowerCase();
}

/** The id of an existing image (from POST /image); 4016 otherwise. */
export async function parseImageId(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !isValidObjectId(value) ||
    !(await image.exists({ _id: value }))
  )
    invalid(CustomStatus.INVALID_IMAGE_ID, `${field} must be an image id`);
  return value;
}

/** A boolean; 4011 otherwise. */
export function parseBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean")
    invalid(CustomStatus.INVALID_BODY, `${field} must be true or false`);
  return value;
}

// ---- Join questions and recruiting (contract v4 §5.6) -----------------------

/**
 * The questions of a SIG without its own: the three global ones of the
 * frontend's app/[userID]/(User)/config/joinQuestions.ts, all required (as
 * the join form has always required them).
 */
export const DEFAULT_JOIN_QUESTIONS: readonly JoinQuestion[] = [
  { label: "自我介紹", required: true },
  { label: "為什麼想加入這個 SIG", required: true },
  { label: "有興趣的主題", required: true },
];
export const JOIN_QUESTIONS_MAX = 5;
export const JOIN_QUESTION_LABEL_MAX_LENGTH = 60;
export const JOIN_ANSWER_MAX_LENGTH = 500;
export const RECRUITING_MESSAGE_MAX_LENGTH = 200;

/** The SIG's join questions: its own, or the defaults. */
export function resolveJoinQuestions(sigData: {
  joinQuestions?: JoinQuestion[] | null;
}): JoinQuestion[] {
  const own = sigData?.joinQuestions;
  const list = own && own.length > 0 ? own : DEFAULT_JOIN_QUESTIONS;
  return list.map((question) => ({
    label: question.label ?? "",
    required: Boolean(question.required),
  }));
}

/** The SIG's recruiting settings with the defaults (open, "", no end). */
export function resolveRecruiting(sigData: {
  recruiting?: Recruiting | null;
}): { open: boolean; message: string; until: string | null } {
  const recruiting = sigData?.recruiting ?? {};
  const until = recruiting.until ? new Date(recruiting.until) : null;
  return {
    open: recruiting.open !== false,
    message: recruiting.message ?? "",
    until: until && !Number.isNaN(until.getTime()) ? until.toISOString() : null,
  };
}

/** Whether the SIG takes join requests now: open, and not past `until`. */
export function isRecruiting(
  sigData: { recruiting?: Recruiting | null },
  now = new Date(),
) {
  const { open, until } = resolveRecruiting(sigData);
  return open && (until === null || new Date(until) > now);
}

/**
 * `joinQuestions` from POST /sig/:id: 1 to 5 `{ label (1-60), required }`,
 * or null to go back to the defaults (returned as null).
 */
export function parseJoinQuestions(value: unknown): JoinQuestion[] | null {
  if (value === null) return null;
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > JOIN_QUESTIONS_MAX
  )
    invalid(
      CustomStatus.INVALID_BODY,
      `joinQuestions must be 1 to ${JOIN_QUESTIONS_MAX} questions, or null`,
    );

  return value.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => key !== "label" && key !== "required") ||
      typeof item.label !== "string" ||
      typeof item.required !== "boolean"
    )
      invalid(
        CustomStatus.INVALID_BODY,
        `joinQuestions[${index}] must be { label, required }`,
      );
    const label = item.label.trim();
    const length = Array.from(label).length;
    if (length < 1 || length > JOIN_QUESTION_LABEL_MAX_LENGTH)
      invalid(
        CustomStatus.INVALID_CONTENT_LENGTH,
        `joinQuestions[${index}].label must be 1 to ${JOIN_QUESTION_LABEL_MAX_LENGTH} characters`,
      );
    return { label, required: item.required };
  });
}

/**
 * `recruiting` from POST /sig/:id: any of `{ open, message, until }`
 * (until: an ISO date or null), merged into the current settings.
 */
export function parseRecruiting(
  value: unknown,
  current: Recruiting | null | undefined,
): { open: boolean; message: string; until: Date | null } {
  const KEYS = ["open", "message", "until"];
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0 ||
    Object.keys(value).some((key) => !KEYS.includes(key))
  )
    invalid(
      CustomStatus.INVALID_BODY,
      "recruiting must be an object with any of: open, message, until",
    );
  const input = value as Record<string, unknown>;
  const resolved = resolveRecruiting({ recruiting: current });

  let open = resolved.open;
  if (input.open !== undefined)
    open = parseBoolean(input.open, "recruiting.open");

  let message = resolved.message;
  if (input.message !== undefined) {
    if (typeof input.message !== "string")
      invalid(CustomStatus.INVALID_BODY, "recruiting.message must be a string");
    message = input.message.trim();
    if (Array.from(message).length > RECRUITING_MESSAGE_MAX_LENGTH)
      invalid(
        CustomStatus.INVALID_CONTENT_LENGTH,
        `recruiting.message must be at most ${RECRUITING_MESSAGE_MAX_LENGTH} characters`,
      );
  }

  let until = resolved.until ? new Date(resolved.until) : null;
  if (input.until !== undefined) {
    if (input.until === null) until = null;
    else {
      const date =
        typeof input.until === "string" ? new Date(input.until) : null;
      if (!date || Number.isNaN(date.getTime()))
        invalid(
          CustomStatus.INVALID_BODY,
          "recruiting.until must be an ISO date or null",
        );
      until = date;
    }
  }

  return { open, message, until };
}

/**
 * The answers of a join request (POST /sig/:sigId/join), checked against
 * the SIG's questions.
 *
 * - `{ answers: [...] }`: one item per question, in order, each a string
 *   or `{ question?, answer }` (`question` is ignored: the stored label is
 *   the SIG's). Fewer items than questions leave the rest unanswered.
 * - `{ q1, q2, q3 }` (the form before contract v4): the first three answers.
 *
 * Required answers must not be empty (4011); each is at most 500 characters
 * (4023). Returns every question with its answer, and q1..q3 for the email
 * template: the first three answers, with the 4th and 5th appended to q3 as
 * 「題目：答案」 lines.
 */
export function parseJoinAnswers(
  body: unknown,
  questions: JoinQuestion[],
): { answers: JoinAnswer[]; q1: string; q2: string; q3: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    invalid(CustomStatus.INVALID_BODY, "Body must be a JSON object");
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);

  let raw: unknown[];
  if (keys.length === 1 && keys[0] === "answers") {
    if (!Array.isArray(input.answers))
      invalid(CustomStatus.INVALID_BODY, "answers must be a list");
    raw = input.answers;
  } else if (
    keys.length === 3 &&
    ["q1", "q2", "q3"].every((key) => keys.includes(key))
  ) {
    raw = [input.q1, input.q2, input.q3];
  } else {
    invalid(
      CustomStatus.INVALID_BODY,
      "Body must be { answers } or { q1, q2, q3 }",
    );
  }
  if (raw.length > questions.length)
    raw.slice(questions.length).forEach((extra, offset) => {
      // The old form always sends three answers; empty extras are fine.
      if (answerText(extra, questions.length + offset) !== "")
        invalid(
          CustomStatus.INVALID_BODY,
          `This SIG asks ${questions.length} question(s)`,
        );
    });

  const answers = questions.map((question, index) => {
    const answer = answerText(raw[index], index);
    if (Array.from(answer).length > JOIN_ANSWER_MAX_LENGTH)
      invalid(
        CustomStatus.INVALID_CONTENT_LENGTH,
        `Each answer is at most ${JOIN_ANSWER_MAX_LENGTH} characters`,
      );
    if (question.required && answer === "")
      invalid(
        CustomStatus.INVALID_BODY,
        `The answer to 「${question.label}」 is required`,
      );
    return { question: question.label, answer };
  });

  const extras = answers
    .slice(3)
    .filter((item) => item.answer !== "")
    .map((item) => `${item.question}：${item.answer}`);
  const q3 = [answers[2]?.answer ?? "", ...extras]
    .filter((line) => line !== "")
    .join("\n");

  return {
    answers,
    q1: answers[0]?.answer ?? "",
    q2: answers[1]?.answer ?? "",
    q3,
  };
}

// One answer: a string or { question?, answer }, trimmed; missing is "".
function answerText(item: unknown, index: number) {
  if (item === undefined || item === null) return "";
  if (typeof item === "string") return item.trim();
  if (
    typeof item === "object" &&
    !Array.isArray(item) &&
    Object.keys(item).every((key) => key === "question" || key === "answer") &&
    typeof (item as { answer?: unknown }).answer === "string"
  )
    return ((item as { answer: string }).answer ?? "").trim();
  invalid(
    CustomStatus.INVALID_BODY,
    `answers[${index}] must be a string or { question, answer }`,
  );
}

/**
 * The labelled answers of a join request: the stored ones, or for a
 * request from before contract v4, q1..q3 with the default labels.
 */
export function joinRequestAnswers(request: {
  answers?: JoinAnswer[] | null;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
}): JoinAnswer[] {
  if (request.answers && request.answers.length > 0)
    return request.answers.map((item) => ({
      question: item.question ?? "",
      answer: item.answer ?? "",
    }));
  return [request.q1, request.q2, request.q3].map((answer, index) => ({
    question: DEFAULT_JOIN_QUESTIONS[index].label,
    answer: answer ?? "",
  }));
}

/**
 * A SIG as the read routes return it: the stored document with `color` and
 * `defaultCover` resolved (the SIG's own value, else the old hardcoded one,
 * else ""), and `joinQuestions` and `recruiting` with their defaults.
 */
export function toSigResponse(doc: any): Record<string, any> {
  const plain =
    typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
  // Private (contract v4 §3.6), even if a query selected it.
  delete plain.discordWebhook;
  return {
    ...plain,
    color: sigColor(plain),
    defaultCover: sigDefaultCover(plain),
    joinQuestions: resolveJoinQuestions(plain),
    recruiting: resolveRecruiting(plain),
  };
}
