/**
 * Append a plain-language row after QA implement push (for operator briefings).
 * Also POSTs to production /api/agents/qa-runs when CRON_SECRET is set.
 *
 * Usage:
 *   npx tsx scripts/log-qa-automation-commit.ts \
 *     --sha abc1234 --session 532452401 --trigger bot_failure \
 *     --cause "Bot sent never-stuck instead of lookup on known receipt order" \
 *     --files "hom-bot.md,conversation-hints.ts" \
 *     --key "<payload idempotency_key>" --token "<payload callback_token>"
 *
 * --key/--token come from the webhook payload (automations have no secrets store);
 * CRON_SECRET still works for local/operator runs.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildHomServiceConversationUrl } from "../lib/landbot/cursor-automation-qa"

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

function loadEnvFile(relativePath: string) {
  const path = join(process.cwd(), relativePath)
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      if (process.env[key]?.trim()) continue
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value) process.env[key] = value
    }
  } catch {
    // optional env files
  }
}

async function syncDashboard(row: LogRow, eventKey: string, callbackToken: string) {
  const secret = callbackToken || process.env.CRON_SECRET?.trim()
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const origin =
    process.env.GEMINI_API_ORIGIN?.trim() ||
    (productionHost
      ? `https://${productionHost.replace(/^https?:\/\//, "")}`
      : "https://gemini-xi-one-77.vercel.app")

  if (!secret) {
    console.warn(
      "[log-qa-automation-commit] no --token (payload callback_token) or CRON_SECRET — dashboard not updated"
    )
    return { ok: false as const, reason: "missing_token" as const }
  }

  const conversationUrl = buildHomServiceConversationUrl(row.session_id)
  const response = await fetch(`${origin}/api/agents/qa-runs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: row.session_id,
      conversation_url: conversationUrl,
      trigger: row.trigger,
      phase: "implement",
      outcome: "implemented",
      root_cause: row.cause,
      commit_sha: row.sha,
      changed_files: row.files,
      idempotency_key: eventKey || `${row.session_id}:implemented:${row.sha}`,
      stage_timestamps: {
        implement_completed_at: row.logged_at,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.warn(
      `[log-qa-automation-commit] dashboard sync failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`
    )
    return { ok: false as const, reason: "dashboard_http_failed" as const, status: response.status }
  }

  return { ok: true as const }
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")
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
  const dashboard = await syncDashboard(row, arg("--key"), arg("--token"))
  console.log(JSON.stringify({ ok: true, sha, brief: BRIEF_PATH, dashboard }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
