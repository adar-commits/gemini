/**
 * Smoke-test the QA self-improve Cursor automation webhook (auth + reachability).
 * Sends `test: true` — the automation must acknowledge and stop without edits.
 *
 * Usage (needs CURSOR_AUTOMATION_QA_WEBHOOK_URL / _TOKEN in env or .env.production.local):
 *   npx tsx scripts/e2e-verify-qa-automations.ts
 *   npx tsx scripts/e2e-verify-qa-automations.ts --session 532360395
 *   npx tsx scripts/e2e-verify-qa-automations.ts --live   # real run, no test flag
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildCursorAutomationQaPayload,
  cursorAutomationQaAuthToken,
  cursorAutomationQaWebhookUrl,
  postCursorAutomationWebhook,
  qaEventWindowPayloadFields,
} from "../lib/landbot/cursor-automation-qa"
import { resolveQaEventWindow } from "../lib/landbot/qa-event-window"

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

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")

  const url = cursorAutomationQaWebhookUrl()
  const token = cursorAutomationQaAuthToken()
  if (!url || !token) {
    console.error("Missing CURSOR_AUTOMATION_QA_WEBHOOK_URL or CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN")
    process.exit(1)
  }

  const live = process.argv.includes("--live")
  const sessionId = arg("--session") ?? "508272038"
  const eventWindow = live
    ? await resolveQaEventWindow(sessionId).catch(() => null)
    : null
  const payload = buildCursorAutomationQaPayload({
    sessionId,
    landbotCustomerId: sessionId,
    trigger: "human_assign",
    handoffAction: "human_service",
    idempotencyKey: `e2e-${sessionId}-${Date.now()}`,
    ...qaEventWindowPayloadFields(eventWindow),
  })
  const body = live ? payload : { ...payload, test: true }

  console.log(JSON.stringify({ url, live, idempotency: payload.idempotency_key }, null, 2))

  const result = await postCursorAutomationWebhook({ url, token, body, timeoutMs: 15_000 })
  if (!result.ok) {
    console.error(
      "Webhook FAILED:",
      "status" in result ? `HTTP ${result.status} ${result.detail ?? ""}` : result.reason
    )
    console.error(
      "HTTP 401 → token was generated on a different automation than the URL. Regenerate on the same automation."
    )
    process.exit(1)
  }

  console.log("Webhook: HTTP 200 — run should appear at cursor.com/automations.")
  if (!live) console.log("Test payload — the run should reply 'webhook OK' and stop without edits.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
