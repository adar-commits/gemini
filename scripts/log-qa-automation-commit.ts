/**
 * Append a plain-language row after QA implement push (for operator briefings).
 *
 * Usage:
 *   npx tsx scripts/log-qa-automation-commit.ts \
 *     --sha abc1234 --session 532452401 --trigger bot_failure \
 *     --cause "Bot sent never-stuck instead of lookup on known receipt order" \
 *     --files "hom-bot.md,conversation-hints.ts"
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(process.cwd(), ".cursor/automations/hom-conversation-qa")
const LOG_PATH = join(ROOT, "commit-log.jsonl")
const BRIEF_PATH = join(ROOT, "BRIEF.md")
const MAX_BRIEF_ENTRIES = 40

type LogRow = {
  sha: string
  session_id: string
  trigger: string
  cause: string
  files: string[]
  logged_at: string
  status: "live" | "vanished"
  vanished_at?: string
}

function arg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1]?.trim() : ""
}

function main() {
  const sha = arg("--sha")
  const sessionId = arg("--session")
  const trigger = arg("--trigger")
  const cause = arg("--cause")
  const filesRaw = arg("--files")

  if (!sha || !sessionId || !trigger || !cause) {
    console.error(
      "Usage: log-qa-automation-commit.ts --sha SHA --session ID --trigger TRIGGER --cause TEXT [--files a,b]"
    )
    process.exit(1)
  }

  const row: LogRow = {
    sha,
    session_id: sessionId,
    trigger,
    cause,
    files: filesRaw
      ? filesRaw.split(",").map((part) => part.trim()).filter(Boolean)
      : [],
    logged_at: new Date().toISOString(),
    status: "live",
  }

  appendFileSync(LOG_PATH, `${JSON.stringify(row)}\n`, "utf8")

  const line = `- **${sha.slice(0, 7)}** · chat [${sessionId}](https://service.hom-group.co.il/conversations/${sessionId}) · ${trigger} — ${cause}${row.files.length ? ` _(files: ${row.files.join(", ")})_` : ""} · vanish: \`npm run qa:vanish ${sha}\``

  let brief = ""
  try {
    brief = readFileSync(BRIEF_PATH, "utf8")
  } catch {
    brief =
      "# QA automation brief\n\nPlain-language log of auto-fix commits. Tell the agent: **vanish commit `sha`** to revert.\n\n## Recent\n\n"
  }

  const marker = "## Recent\n\n"
  const idx = brief.indexOf(marker)
  if (idx < 0) {
    brief += `\n${marker}${line}\n`
  } else {
    const head = brief.slice(0, idx + marker.length)
    const tail = brief.slice(idx + marker.length)
    const entries = tail.split("\n").filter((entry) => entry.startsWith("- **"))
    const next = [line, ...entries].slice(0, MAX_BRIEF_ENTRIES).join("\n")
    brief = `${head}${next}\n`
  }

  writeFileSync(BRIEF_PATH, brief, "utf8")
  console.log(JSON.stringify({ ok: true, sha, brief: BRIEF_PATH }, null, 2))
}

main()
