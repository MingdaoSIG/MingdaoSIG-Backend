import TTLCache from "@module/TTLCache";
import { readSetting, writeSetting } from "@module/Setting";
import {
  NOTE_MAX,
  ReportModel,
  ReportTargetKind,
  SYSTEM_REPORTER,
} from "@module/Report";

/**
 * Keyword filter (關鍵字過濾, contract v4 §5.11). Posts (title, content,
 * hashtags) and comments (content) are checked on create and edit with a
 * case-insensitive substring match against the admin's word list. A match
 * files a report from "system" with reason "keyword" and the matched words
 * as the note. It never blocks posting, and a target never gets a second
 * open keyword report.
 *
 * Stored in the `setting` collection under the key `keywordFilter` as
 * `{ words: [string] }`.
 */

export const KEYWORD_FILTER_KEY = "keywordFilter";
export const MAX_WORDS = 200;
export const MAX_WORD_LENGTH = 30;

const DUPLICATE_KEY = 11000;

export type KeywordFilter = {
  words: string[];
  updatedAt: Date | null;
  updatedBy: string | null;
};

// The list is read on every post and comment write; edits clear it.
const cache = new TTLCache<KeywordFilter>(60 * 1000, 1);

export function getKeywordFilter() {
  return cache.getOrLoad("filter", async () => {
    const setting = await readSetting(KEYWORD_FILTER_KEY);
    const words = Array.isArray(setting?.value?.words)
      ? setting.value.words.filter(
          (word: unknown): word is string =>
            typeof word === "string" && word !== "",
        )
      : [];
    return {
      words,
      updatedAt: setting?.updatedAt ?? null,
      updatedBy: setting?.updatedBy ?? null,
    };
  });
}

export async function saveKeywordFilter(words: string[], by: string) {
  const setting = await writeSetting(KEYWORD_FILTER_KEY, { words }, by);
  cache.clear();
  return {
    words,
    updatedAt: setting?.updatedAt ?? null,
    updatedBy: setting?.updatedBy ?? by,
  };
}

/** The words found in any of the texts (case-insensitive substrings). */
export function matchKeywords(texts: unknown[], words: string[]) {
  const haystack = texts
    .filter((text): text is string => typeof text === "string")
    .map((text) => text.toLowerCase());
  if (haystack.length === 0) return [];
  return words.filter((word) => {
    const needle = word.toLowerCase();
    return haystack.some((text) => text.includes(needle));
  });
}

function noteFor(matched: string[]) {
  return Array.from(matched.join(", ")).slice(0, NOTE_MAX).join("");
}

/**
 * Checks the texts and files a keyword report on a match, unless the target
 * already has an open one. Returns whether a report was filed. Never throws.
 */
export async function checkKeywords(target: {
  kind: ReportTargetKind;
  id: string;
  texts: unknown[];
}) {
  try {
    const { words } = await getKeywordFilter();
    if (words.length === 0) return false;
    const matched = matchKeywords(target.texts, words);
    if (matched.length === 0) return false;

    const open = {
      reporter: SYSTEM_REPORTER,
      "target.kind": target.kind,
      "target.id": target.id,
      status: "open",
    };
    if (await ReportModel.exists(open)) return false;
    await ReportModel.create({
      reporter: SYSTEM_REPORTER,
      target: { kind: target.kind, id: target.id },
      reason: "keyword",
      note: noteFor(matched),
      status: "open",
    });
    return true;
  } catch (error: any) {
    // A concurrent edit filed it first (unique index on open reports).
    if (error?.code === DUPLICATE_KEY) return false;
    console.error(
      `KeywordFilter : failed to check ${target.kind}:${target.id}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Runs checkKeywords in the background; the write never waits for it. */
export function scanForKeywords(target: {
  kind: ReportTargetKind;
  id: string;
  texts: unknown[];
}) {
  void checkKeywords(target);
}
