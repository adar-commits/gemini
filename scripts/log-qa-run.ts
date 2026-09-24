/**
 * Log QA analyze or implement outcome to Supabase + BRIEF.md (implement only).
 *
 * Analyze example:
 *   npx tsx scripts/log-qa-run.ts --phase analyze --session 532452401 \
 *     --trigger bot_failure --verdict real_failure --confidence high \
 *     --outcome chained --risk 7 --cause "Never-stuck with receipt in thread" \
 *     --idempotency-key "532452401:bot_failure:123"
 *
 * Implement example:
 *   npx tsx scripts/log-qa-run.ts --phase implement --session 532452401 \
 *     --trigger bot_failure --outcome implemented --risk 6 \
 *     --cause "Added hint for receipt order confirm" --sha abc1234 \
 *     --files "conversation-hints.ts"
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { QaAutomationOutcome, QaAutomationPhase } from "../lib/agents/qa-automation-log"
import { insertQaAutomationRun } from "../lib/agents/qa-automation-log"
import { buildHomServiceConversationUrl } from "../lib/landbot/cursor-automation-qa"

function loadEnvFile(relativePath: string) {
  const path = join(process.cwd(), relativePath)
  if (!existsSync(path)) return
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
}

function arg(name: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1]?.trim() : ""
}

function appendBrief(line: string) {
  const ROOT = join(process.cwd(), ".cursor/automations/hom-conversation-qa")
  const BRIEF_PATH = join(ROOT, "BRIEF.md")
  const marker = "## Recent\n\n"
  let brief = ""
  try {
    brief = readFileSync(BRIEF_PATH, "utf8")
  } catch {
    brief =
      "# QA automation brief\n\nPlain-language log. Dashboard: /dashboard/qa\n\n## Recent\n\n"
  }
  const idx = brief.indexOf(marker)
  const head = idx >= 0 ? brief.slice(0, idx + marker.length) : `${brief}\n${marker}`
  const tail = idx >= 0 ? brief.slice(idx + marker.length) : ""
  const entries = tail.split("\n").filter((entry) => entry.startsWith("- **"))
  const next = [line, ...entries].slice(0, 40).join("\n")
  writeFileSync(BRIEF_PATH, `${head}${next}\n`, "utf8")
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const phase = arg("--phase") as QaAutomationPhase
  const sessionId = arg("--session")
  const trigger = arg("--trigger")
  const outcome = arg("--outcome") as QaAutomationOutcome
  const cause = arg("--cause")
  const riskRaw = arg("--risk")
  const riskScore = riskRaw ? Number(riskRaw) : undefined

  if (!phase || !sessionId || !trigger || !outcome || !cause) {
    console.error("Missing required: --phase --session --trigger --outcome --cause")
    process.exit(1)
  }

  const row = await insertQaAutomationRun({
    sessionId,
    conversationUrl:
      arg("--url") || buildHomServiceConversationUrl(sessionId),
    landbotCustomerId: arg("--landbot-customer-id") || null,
    trigger,
    phase,
    outcome,
    verdict: arg("--verdict") || null,
    confidence: arg("--confidence") || null,
    riskScore:
      riskScore != null && Number.isFinite(riskScore) ? riskScore : null,
    rootCause: cause,
    fixLayer: arg("--fix-layer") || null,
    fixPlan: arg("--fix-plan")
      ? arg("--fix-plan")
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
    operatorQuestions: arg("--questions")
      ? arg("--questions")
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
    commitSha: arg("--sha") || null,
    changedFiles: arg("--files")
      ? arg("--files")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
    idempotencyKey: arg("--idempotency-key") || null,
    operatorNotes: arg("--notes") || null,
  })

  if (phase === "implement" && row.commit_sha) {
    const line = `- **${row.commit_sha.slice(0, 7)}** · [${sessionId}](${row.conversation_url}) · ${outcome} — ${cause}${row.changed_files.length ? ` _(files: ${row.changed_files.join(", ")})_` : ""} · [dashboard](/dashboard/qa) · vanish: \`npm run qa:vanish ${row.commit_sha}\``
    appendBrief(line)
  }

  console.log(JSON.stringify({ ok: true, id: row.id, outcome: row.outcome }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
