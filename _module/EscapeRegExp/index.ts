/** Escapes text so a regular expression matches it literally. */
export default function EscapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
