/**
 * iCalendar (RFC 5545) output for SIG events.
 *
 * - Times are UTC (`YYYYMMDDTHHMMSSZ`), so no VTIMEZONE is needed.
 * - TEXT values escape backslashes, semicolons, commas and newlines.
 * - Lines end with CRLF and are folded at 75 octets without splitting a
 *   UTF-8 character; continuation lines start with one space.
 */

export const ICS_CONTENT_TYPE = "text/calendar; charset=utf-8";

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  created?: Date;
  lastModified?: Date;
};

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** A DATE-TIME in UTC: 20261112T080000Z. */
export function formatUtc(date: Date) {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/** Folds one content line at 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string) {
  if (Buffer.byteLength(line, "utf8") <= MAX_LINE_OCTETS) return line;

  const parts: string[] = [];
  let current = "";
  let octets = 0;
  // The first line holds 75 octets, the others 74 after the leading space.
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** A whole VCALENDAR with one VEVENT per event. */
export function buildCalendar(
  events: IcsEvent[],
  option: { name?: string; now?: Date } = {},
) {
  const stamp = formatUtc(option.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MingdaoSIG//SIG Events//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (option.name) lines.push(`X-WR-CALNAME:${escapeText(option.name)}`);

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(event.start)}`,
      `DTEND:${formatUtc(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description ?? "")}`,
      `LOCATION:${escapeText(event.location ?? "")}`,
    );
    // URI values are not TEXT: no escaping (the value has no CR/LF).
    if (event.url) lines.push(`URL:${event.url.replace(/[\r\n]/g, "")}`);
    if (event.created) lines.push(`CREATED:${formatUtc(event.created)}`);
    if (event.lastModified)
      lines.push(`LAST-MODIFIED:${formatUtc(event.lastModified)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
