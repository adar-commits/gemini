/**
 * KB sync — weekday change-detect for lib/agents/kb/sources.yaml URLs.
 *
 * Usage:
 *   npx tsx scripts/kb-sync.ts [--dry-run] [--apply] [--id=carpet-shipping]
 *
 * --dry-run   fetch + compare hashes; print report; no writes (default in local dev)
 * --apply     write lockfile, drafts, stamp updates; exit 2 if changes detected (for CI PR step)
 * --id=...    single source (matches workflow_dispatch)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import {
  computeContentHash,
  extractLiveStamp,
  extractPreserveBlock,
  htmlToText,
  normalizeForHash,
  splitKbSection,
} from "../lib/agents/kb/sync-utils";

const ROOT = join(__dirname, "..");
const KB_DIR = join(ROOT, "lib", "agents", "kb");
const SOURCES_PATH = join(KB_DIR, "sources.yaml");
const LOCK_PATH = join(KB_DIR, "sources.lock.json");
const DRAFTS_DIR = join(KB_DIR, ".sync-drafts");
const REPORT_PATH = join(KB_DIR, ".sync-report.json");

type ExtractMode = "curated_bullets" | "cite_only";

interface SourceConfig {
  id: string;
  url: string;
  kb_file: string;
  kb_section: string;
  tier: number;
  extract: ExtractMode;
  preserve_notes?: string[];
  secondary_kb_file?: string;
}

interface LockFile {
  version: 1;
  entries: Record<
    string,
    {
      hash: string;
      stamp: string | null;
      fetched_at: string;
      url: string;
    }
  >;
}

interface SyncChange {
  id: string;
  url: string;
  previousHash: string | null;
  nextHash: string;
  stamp: string | null;
  material: boolean;
  kb_file: string;
  kb_section: string;
  draftPath: string | null;
  stampUpdated: boolean;
}

interface CliOptions {
  dryRun: boolean;
  apply: boolean;
  lockOnly: boolean;
  id: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: true, apply: false, lockOnly: false, id: null };
  for (const arg of argv) {
    if (arg === "--apply") {
      opts.apply = true;
      opts.dryRun = false;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
      opts.apply = false;
    } else if (arg === "--lock-only") {
      opts.lockOnly = true;
      opts.apply = true;
      opts.dryRun = false;
    } else if (arg.startsWith("--id=")) {
      opts.id = arg.slice("--id=".length).trim() || null;
    }
  }
  return opts;
}

function loadSources(): SourceConfig[] {
  const raw = readFileSync(SOURCES_PATH, "utf8");
  const doc = parseYaml(raw) as { sources: SourceConfig[] };
  return doc.sources;
}

function loadLock(): LockFile {
  if (!existsSync(LOCK_PATH)) {
    return { version: 1, entries: {} };
  }
  return JSON.parse(readFileSync(LOCK_PATH, "utf8")) as LockFile;
}

function saveLock(lock: LockFile): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "gemini-kb-sync/1.0 (+https://github.com/adar-commits/gemini)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

function removePreserveBlocks(section: string, headings: string[]): string {
  let result = section;
  for (const heading of headings) {
    const block = extractPreserveBlock(result, heading);
    if (block) {
      result = result.replace(block, "").trimEnd();
    }
  }
  return result;
}

function updateSectionStamp(section: string, stamp: string | null): { section: string; updated: boolean } {
  if (!stamp) return { section, updated: false };
  const stampLine = /^(Updated\s+\d{2}\.\d{2}\.\d{2})/m;
  if (stampLine.test(section)) {
    const next = section.replace(stampLine, `Updated ${stamp}`);
    return { section: next, updated: next !== section };
  }
  const sourceLine = /^(Source:\s+https?:\/\/\S+)/m;
  if (sourceLine.test(section)) {
    const next = section.replace(sourceLine, `$1\nUpdated ${stamp}`);
    return { section: next, updated: true };
  }
  return { section, updated: false };
}

function draftBulletsFromPolicy(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    if (/^\d+(\.\d+)*\s/.test(line)) {
      bullets.push(`- ${line.replace(/^\d+(\.\d+)*\s+/, "")}`);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      bullets.push(`- ${line.replace(/^[-•]\s+/, "")}`);
    }
  }
  return bullets.slice(0, 80);
}

function writeDraft(source: SourceConfig, text: string, stamp: string | null): string {
  mkdirSync(DRAFTS_DIR, { recursive: true });
  const draftPath = join(DRAFTS_DIR, `${source.id}.md`);
  const bullets =
    source.extract === "curated_bullets" ? draftBulletsFromPolicy(text) : [];
  const body = [
    `# KB sync draft — ${source.id}`,
    "",
    `Source: ${source.url}`,
    stamp ? `Live stamp: ${stamp}` : "Live stamp: (not found)",
    `Target: ${source.kb_file} → ${source.kb_section}`,
    "",
    "## Curated bullet draft (human review required)",
    "",
    ...bullets,
    "",
    "## Normalized live extract (truncated)",
    "",
    text.slice(0, 12000),
    text.length > 12000 ? "\n\n… truncated …" : "",
    "",
  ].join("\n");
  writeFileSync(draftPath, body, "utf8");
  return draftPath;
}

function applyKbChanges(
  source: SourceConfig,
  text: string,
  stamp: string | null,
): { stampUpdated: boolean; draftPath: string | null } {
  if (source.extract === "cite_only") {
    return { stampUpdated: false, draftPath: null };
  }

  const kbPath = join(KB_DIR, source.kb_file);
  const content = readFileSync(kbPath, "utf8");
  const split = splitKbSection(content, source.kb_section);
  if (!split) {
    throw new Error(`KB section not found: ${source.kb_file} → ${source.kb_section}`);
  }

  const preserveHeadings = source.preserve_notes ?? [];
  const preserved: string[] = [];
  for (const heading of preserveHeadings) {
    const block = extractPreserveBlock(split.section, heading);
    if (block) preserved.push(block);
  }

  let { section, updated: stampUpdated } = updateSectionStamp(split.section, stamp);
  section = removePreserveBlocks(section, preserveHeadings);
  if (preserved.length > 0) {
    section = `${section.trimEnd()}\n\n${preserved.join("\n\n")}\n`;
  }

  for (const heading of preserveHeadings) {
    const hadBlock = extractPreserveBlock(split.section, heading);
    const stillHas = extractPreserveBlock(section, heading);
    if (hadBlock && !stillHas) {
      throw new Error(
        `preserve_notes would delete block "${heading}" in ${source.id} — aborting`,
      );
    }
  }

  const nextContent = `${split.before}${section}${split.after}`;
  writeFileSync(kbPath, nextContent, "utf8");

  const draftPath = writeDraft(source, text, stamp);
  return { stampUpdated, draftPath };
}

async function syncSource(
  source: SourceConfig,
  lock: LockFile,
  opts: CliOptions,
): Promise<SyncChange | null> {
  const html = await fetchPage(source.url);
  const text = htmlToText(html);
  const normalized = normalizeForHash(text);
  const hash = computeContentHash(normalized);
  const stamp = extractLiveStamp(text);
  const previous = lock.entries[source.id]?.hash ?? null;

  if (previous === hash) {
    console.log(`[kb-sync] ${source.id}: unchanged (${hash.slice(0, 12)}…)`);
    return null;
  }

  console.log(
    `[kb-sync] ${source.id}: CHANGE detected${previous ? "" : " (no prior lock entry)"}`,
  );
  console.log(`  url:   ${source.url}`);
  console.log(`  stamp: ${stamp ?? "(none)"}`);
  console.log(`  hash:  ${previous ?? "—"} → ${hash}`);

  const change: SyncChange = {
    id: source.id,
    url: source.url,
    previousHash: previous,
    nextHash: hash,
    stamp,
    material: previous !== null,
    kb_file: source.kb_file,
    kb_section: source.kb_section,
    draftPath: null,
    stampUpdated: false,
  };

  if (opts.apply) {
    if (!opts.lockOnly) {
      if (source.extract !== "cite_only") {
        const applied = applyKbChanges(source, text, stamp);
        change.draftPath = applied.draftPath;
        change.stampUpdated = applied.stampUpdated;
      } else {
        change.draftPath = writeDraft(source, text, stamp);
      }
    }

    lock.entries[source.id] = {
      hash,
      stamp,
      fetched_at: new Date().toISOString(),
      url: source.url,
    };
  }

  return change;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const sources = loadSources();
  const selected = opts.id
    ? sources.filter((s) => s.id === opts.id)
    : sources.filter((s) => s.tier === 1);

  if (opts.id && selected.length === 0) {
    throw new Error(`Unknown source id: ${opts.id}`);
  }

  const lock = loadLock();
  const changes: SyncChange[] = [];

  for (const source of selected) {
    const change = await syncSource(source, lock, opts);
    if (change) changes.push(change);
  }

  if (opts.apply) {
    saveLock(lock);
    writeFileSync(REPORT_PATH, `${JSON.stringify({ changes }, null, 2)}\n`, "utf8");
  } else if (changes.length > 0) {
    console.log("\n[kb-sync] dry-run only — re-run with --apply to write lock/drafts/stamps");
  }

  if (changes.length === 0) {
    console.log("[kb-sync] no changes — exit 0");
    process.exit(0);
  }

  console.log(`\n[kb-sync] ${changes.length} source(s) changed`);
  if (opts.apply) {
    process.exit(2);
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[kb-sync] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
