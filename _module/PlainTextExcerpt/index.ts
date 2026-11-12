const DEFAULT_LENGTH = 200;
// Only the start of a post is needed for a preview; bounding the input keeps
// the cost per post small even for very long or unusual content.
const MAX_INPUT_LENGTH = 8000;
const CACHE_SIZE = 5000;
const ESCAPE_BASE = 0xe000;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Plain text preview of a post body written in Markdown (with optional
 * HTML): markup, images, code blocks and formulas are removed, link text is
 * kept, whitespace is collapsed. Cut to `length` characters (Unicode code
 * points) with a trailing "…" when the text is longer.
 */
export default function PlainTextExcerpt(
  markdown: unknown,
  length = DEFAULT_LENGTH,
): string {
  if (typeof markdown !== "string" || markdown === "") return "";

  const text = markdown
    .slice(0, MAX_INPUT_LENGTH)
    // Markdown escapes such as \* or \#: park the character in the private
    // use area so the markup rules below leave it alone, restore at the end.
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~$<])/g, (_, char: string) =>
      String.fromCharCode(ESCAPE_BASE + char.charCodeAt(0)),
    )
    // Fenced code blocks and display formulas (an unclosed one runs to the end)
    .replace(/^ {0,3}(```|~~~)[\s\S]*?(^ {0,3}\1|$(?![\s\S]))/gm, " ")
    .replace(/\$\$[^$]*(\$\$|$(?![\s\S]))/g, " ")
    // HTML comments and tags
    .replace(/<!--[\s\S]*?(-->|$(?![\s\S]))/g, " ")
    .replace(/<\/?[a-zA-Z][^<>]*>/g, " ")
    // Images, then links (keep the link text)
    .replace(/!\[[^\]\n]*\](\([^)\n]*\)|\[[^\]\n]*\])/g, " ")
    .replace(/\[([^\]\n]*)\](\([^)\n]*\)|\[[^\]\n]*\])/g, "$1")
    // Reference link definitions: [id]: https://...
    .replace(/^ {0,3}\[[^\]\n]+\]:[ \t]+\S.*$/gm, " ")
    // Headings, blockquotes, list markers, horizontal rules, table rules
    .replace(/^ {0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^ {0,3}(>[ \t]?)+/gm, "")
    .replace(/^[ \t]*([-*+]|\d+[.)])[ \t]+(\[[ xX]\][ \t]+)?/gm, "")
    .replace(/^ {0,3}([-*_][ \t]*){3,}$/gm, " ")
    .replace(/^[ \t]*\|?([ \t]*:?-+:?[ \t]*\|)+([ \t]*:?-+:?[ \t]*)?$/gm, " ")
    .replace(/\|/g, " ")
    // Inline code, emphasis and strikethrough markers
    .replace(/`+/g, "")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/(^|[^\w*])[*_](?=\S)/g, "$1")
    .replace(/(\S)[*_](?=[^\w*]|$)/g, "$1")
    // Inline formulas
    .replace(/\$[^$\n]+\$/g, " ")
    // HTML entities
    .replace(/&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g, decodeEntity)
    .replace(/[\uE000-\uE07F]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - ESCAPE_BASE),
    )
    .replace(/\s+/g, " ")
    .trim();

  const characters = Array.from(text);
  if (characters.length <= length) return text;

  return characters.slice(0, length).join("").trimEnd() + "…";
}

const cache = new Map<string, string>();

/**
 * PlainTextExcerpt with a bounded in-memory cache. The key must change when
 * the content changes, for example `${_id}:${updatedAt}`.
 */
export function CachedPlainTextExcerpt(key: string, markdown: unknown) {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const excerpt = PlainTextExcerpt(markdown);
  cache.set(key, excerpt);
  if (cache.size > CACHE_SIZE) {
    cache.delete(cache.keys().next().value as string);
  }

  return excerpt;
}

function decodeEntity(entity: string, code: string) {
  if (code[0] === "#") {
    const codePoint =
      code[1] === "x" || code[1] === "X"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  }
  return HTML_ENTITIES[code.toLowerCase()] ?? entity;
}
