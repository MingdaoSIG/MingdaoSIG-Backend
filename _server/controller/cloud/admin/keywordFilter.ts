import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import { recordAudit } from "@module/Audit";
import {
  KEYWORD_FILTER_KEY,
  MAX_WORDS,
  MAX_WORD_LENGTH,
  getKeywordFilter,
  saveKeywordFilter,
} from "@module/KeywordFilter";
import { callerId, exactBody, fail, sendError } from "./_shared";

// Keyword filter (關鍵字過濾, contract v4 §5.11), admin only.

/**
 * The words, trimmed, each 1–30 characters, at most 200; repeats (ignoring
 * case) are dropped, keeping the first.
 */
function parseWords(value: unknown) {
  if (!Array.isArray(value))
    fail(CustomStatus.INVALID_BODY, "words must be an array of strings");
  if (value.length > MAX_WORDS)
    fail(CustomStatus.INVALID_BODY, `At most ${MAX_WORDS} words`);

  const words: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string")
      fail(CustomStatus.INVALID_BODY, "words must be an array of strings");
    const word = item.trim();
    const length = Array.from(word).length;
    if (length < 1 || length > MAX_WORD_LENGTH)
      fail(
        CustomStatus.INVALID_BODY,
        `Each word must be 1 to ${MAX_WORD_LENGTH} characters`,
      );
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

// GET /admin/keyword-filter (admin) → { words, updatedAt, updatedBy }
export const readKeywordFilter: RequestHandler = async (_req, res) => {
  try {
    const filter = await getKeywordFilter();
    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: filter });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/keyword-filter { words } (admin): replaces the list.
export const writeKeywordFilter: RequestHandler = async (req, res) => {
  try {
    const words = parseWords(exactBody(req, ["words"]).words);

    const actor = callerId(req);
    const before = new Set(
      (await getKeywordFilter()).words.map((word) => word.toLowerCase()),
    );
    const saved = await saveKeywordFilter(words, actor);
    const after = new Set(words.map((word) => word.toLowerCase()));

    await recordAudit({
      actor,
      action: "keyword.update",
      target: { kind: "setting", id: KEYWORD_FILTER_KEY, label: "關鍵字過濾" },
      meta: {
        count: words.length,
        added: [...after].filter((word) => !before.has(word)).length,
        removed: [...before].filter((word) => !after.has(word)).length,
      },
    });

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: saved });
  } catch (error) {
    return sendError(res, error);
  }
};
