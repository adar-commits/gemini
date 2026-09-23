import { createHash } from "crypto";

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/240\\340/g, "240×340")
    .replace(/300\\400/g, "300×400")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeForHash(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function computeContentHash(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

export function extractLiveStamp(text: string): string | null {
  const hebrew = text.match(/מעודכן\s+ליום\s+(\d{2}\.\d{2}\.\d{2})/);
  if (hebrew?.[1]) return hebrew[1];
  const updated = text.match(/\bUpdated\s+(\d{2}\.\d{2}\.\d{2})\b/i);
  return updated?.[1] ?? null;
}

export function splitKbSection(
  content: string,
  sectionHeader: string,
): { before: string; section: string; after: string } | null {
  const idx = content.indexOf(sectionHeader);
  if (idx === -1) return null;

  const afterHeader = idx + sectionHeader.length;
  const rest = content.slice(afterHeader);
  const headerLevel = sectionHeader.match(/^#+/)?.[0].length ?? 2;
  const nextRe = new RegExp(`^#{1,${headerLevel}}\\s`, "m");
  const nextMatch = rest.search(nextRe);
  const sectionEnd = nextMatch === -1 ? content.length : afterHeader + nextMatch;

  return {
    before: content.slice(0, idx),
    section: content.slice(idx, sectionEnd),
    after: content.slice(sectionEnd),
  };
}

export function extractPreserveBlock(section: string, heading: string): string | null {
  const idx = section.indexOf(heading);
  if (idx === -1) return null;
  const rest = section.slice(idx + heading.length);
  const nextHeading = rest.search(/\n#{2,3}\s/);
  const block =
    nextHeading === -1
      ? section.slice(idx)
      : section.slice(idx, idx + heading.length + nextHeading);
  return block.trimEnd();
}
