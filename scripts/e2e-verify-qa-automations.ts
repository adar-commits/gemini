/**
 * End-to-end verification for HoM QA Analyze + Implement Cursor automations.
 *
 * Usage (needs Vercel/Cursor webhook tokens in env or .env.production.local):
 *   npx tsx scripts/e2e-verify-qa-automations.ts
 *   npx tsx scripts/e2e-verify-qa-automations.ts --session 532360395
 *   npx tsx scripts/e2e-verify-qa-automations.ts --scenario false_alarm
 *   npx tsx scripts/e2e-verify-qa-automations.ts --skip-implement-dry-run
 *   npx tsx scripts/e2e-verify-qa-automations.ts --implement-only --session 532360395
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildCursorAutomationQaPayload,
  cursorAutomationQaAnalyzeAuthToken,
  cursorAutomationQaAnalyzeWebhookUrl,
  cursorAutomationQaImplementAuthToken,
  cursorAutomationQaImplementWebhookUrl,
  postCursorAutomationWebhook,
  qaEventWindowPayloadFields,
} from "../lib/landbot/cursor-automation-qa"
import { resolveQaEventWindow } from "../lib/landbot/qa-event-window"
import {
  buildImplementWebhookPayload,
  parseQaAnalysis,
  shouldChainQaImplement,
  type QaAnalysis,
} from "../lib/hom-agent/qa-analysis"

type Scenario = "false_alarm" | "real_failure"

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
  return idx >= 0 ? process.argv[idx + 1] : null
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
  return value
}

async function postAnalyze(input: { scenario: Scenario; sessionId: string }) {
  const ts = Date.now()
  const sessionId = input.sessionId

  const eventWindow = await resolveQaEventWindow(sessionId).catch(() => null)

  const payload = buildCursorAutomationQaPayload({
    sessionId,
    landbotCustomerId: sessionId,
    trigger: "human_assign",
    handoffAction: "human_service",
    lastUserMessage:
      input.scenario === "false_alarm"
        ? "כן תודה, אשמח לדבר עם נציג"
        : "כן זה ההזמנה",
    lastBotReply:
      input.scenario === "false_alarm"
        ? "מעולה, העברתי את השיחה לנציג שירות. נציג יחזור אליך בהקדם."
        : "האם זו ההזמנה שביקשת?",
    phone: "+972525368636",
    idempotencyKey: `e2e-${input.scenario}-${sessionId}-${ts}`,
    ...qaEventWindowPayloadFields(eventWindow),
  })

  const url = cursorAutomationQaAnalyzeWebhookUrl()
  const token = cursorAutomationQaAnalyzeAuthToken()
  if (!url || !token) {
    console.error("Missing CURSOR_AUTOMATION_QA_ANALYZE_URL or ANALYZE_TOKEN")
    process.exit(1)
  }

  console.log("\n=== ANALYZE webhook ===")
  console.log(
    JSON.stringify(
      { scenario: input.scenario, sessionId, url, idempotency: payload.idempotency_key },
      null,
      2
    )
  )

  const result = await postCursorAutomationWebhook({
    url,
    token,
    body: payload,
    timeoutMs: 15_000,
  })

  if (!result.ok) {
    console.error(
      "Analyze webhook FAILED:",
      "status" in result ? `HTTP ${result.status} ${result.detail ?? ""}` : result.reason
    )
    console.error(
      "\nIf HTTP 401 missing scope: token was generated on a different automation than ANALYZE_URL."
    )
    console.error(
      "Open cursor.com/automations → HoM QA Analyze (Grok) → copy webhook URL + Generate auth header."
    )
    process.exit(1)
  }

  console.log("Analyze webhook: HTTP 200 — Grok run should start in Cursor automations dashboard.")
  console.log("Check /dashboard/qa or hom_agent_qa_runs for a new analyze row within ~2–5 min.")
}

async function postImplementDryRun(sessionId: string) {
  const analysis: QaAnalysis = {
    session_id: sessionId,
    conversation_url: `https://service.hom-group.co.il/conversations/${sessionId}`,
    trigger: "human_assign",
    verdict: "real_failure",
    confidence: "high",
    root_cause: "E2E dry-run — implement webhook smoke test only; do not commit.",
    fix_layer: "hints",
    fix_plan: ["E2E smoke test only — reply no action without code changes."],
    analyzed_at: new Date().toISOString(),
  }

  if (!shouldChainQaImplement(analysis)) {
    console.error("Analysis gate failed unexpectedly")
    process.exit(1)
  }

  const eventWindow = await resolveQaEventWindow(sessionId).catch(() => null)

  const source = buildCursorAutomationQaPayload({
    sessionId,
    trigger: "human_assign",
    idempotencyKey: `e2e-implement-dry-${sessionId}-${Date.now()}`,
    ...qaEventWindowPayloadFields(eventWindow),
  })

  const body = buildImplementWebhookPayload({ source, analysis })
  if (!parseQaAnalysis(body.analysis)) {
    console.error("Implement payload failed parseQaAnalysis")
    process.exit(1)
  }

  const url = cursorAutomationQaImplementWebhookUrl()
  const token = cursorAutomationQaImplementAuthToken()
  if (!url || !token) {
    console.error("Missing CURSOR_AUTOMATION_QA_IMPLEMENT_URL or IMPLEMENT_TOKEN")
    process.exit(1)
  }

  console.log("\n=== IMPLEMENT webhook (dry-run analysis — expect no action) ===")
  console.log(JSON.stringify({ session_id: body.session_id, url, idempotency: body.idempotency_key }, null, 2))

  const result = await postCursorAutomationWebhook({
    url,
    token,
    body,
    timeoutMs: 15_000,
  })

  if (!result.ok) {
    console.error(
      "Implement webhook FAILED:",
      "status" in result ? `HTTP ${result.status} ${result.detail ?? ""}` : result.reason
    )
    process.exit(1)
  }

  console.log("Implement webhook: HTTP 200 — Composer run should start.")
  console.log("Expect chat reply: no action (dry-run plan says do not commit).")
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const scenario = (arg("--scenario") as Scenario | null) ?? "false_alarm"
  if (scenario !== "false_alarm" && scenario !== "real_failure") {
    console.error("Use --scenario false_alarm | real_failure")
    process.exit(1)
  }

  const sessionId = arg("--session") ?? (scenario === "false_alarm" ? "508272038" : "530876768")

  requireEnv("CURSOR_AUTOMATION_QA_ANALYZE_URL")
  requireEnv("CURSOR_AUTOMATION_QA_ANALYZE_TOKEN")
  requireEnv("CURSOR_AUTOMATION_QA_IMPLEMENT_URL")
  requireEnv("CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN")

  if (hasFlag("--implement-only")) {
    await postImplementDryRun(sessionId)
    console.log("\n=== Done (implement-only) ===")
    return
  }

  await postAnalyze({ scenario, sessionId })

  if (!hasFlag("--skip-implement-dry-run")) {
    await postImplementDryRun(sessionId)
  }

  console.log("\n=== Done ===")
  console.log("1. Open cursor.com/automations — confirm both runs appear and complete.")
  console.log("2. Query hom_agent_qa_runs for new rows (analyze outcome should NOT be chained for false_alarm).")
  console.log("3. Implement dry-run should reply no action — no git commit on main.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
