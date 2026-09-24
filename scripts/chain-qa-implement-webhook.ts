/**
 * Grok analyze automation: POST approved analysis to Composer implement webhook.
 *
 * Usage:
 *   npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/532452401.analysis.json
 *   npx tsx scripts/chain-qa-implement-webhook.ts .cursor/qa-queue/532452401.analysis.json --source-payload .cursor/qa-queue/532452401.source.json
 */
import { readFileSync } from "node:fs"
import {
  buildImplementWebhookPayload,
  parseQaAnalysis,
  shouldChainQaImplement,
} from "../lib/hom-agent/qa-analysis"
import type { CursorAutomationQaPayload } from "../lib/landbot/cursor-automation-qa"
import {
  cursorAutomationQaImplementAuthToken,
  cursorAutomationQaImplementWebhookUrl,
  postCursorAutomationWebhook,
} from "../lib/landbot/cursor-automation-qa"

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown
}

async function main() {
  const analysisPath = process.argv[2]
  if (!analysisPath) {
    console.error(
      "Usage: npx tsx scripts/chain-qa-implement-webhook.ts <analysis.json> [--source-payload source.json]"
    )
    process.exit(1)
  }

  const analysis = parseQaAnalysis(readJson(analysisPath))
  if (!analysis) {
    console.error("Invalid analysis JSON — see .cursor/automations/hom-conversation-qa/analysis-schema.json")
    process.exit(1)
  }

  if (!shouldChainQaImplement(analysis)) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          chained: false,
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          reason:
            analysis.verdict === "ask_operator" || analysis.confidence !== "high"
              ? "needs_operator"
              : "not_approved_for_implement",
        },
        null,
        2
      )
    )
    return
  }

  const sourceFlag = process.argv.indexOf("--source-payload")
  const sourcePath = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : null
  const source = sourcePath
    ? (readJson(sourcePath) as CursorAutomationQaPayload)
    : ({
        conversation_url: analysis.conversation_url,
        session_id: analysis.session_id,
        landbot_customer_id: null,
        trigger: analysis.trigger,
        idempotency_key: `${analysis.session_id}:${analysis.trigger}`,
        sent_at: analysis.analyzed_at ?? new Date().toISOString(),
      } satisfies CursorAutomationQaPayload)

  const url = cursorAutomationQaImplementWebhookUrl()
  if (!url) {
    console.error("Missing CURSOR_AUTOMATION_QA_IMPLEMENT_URL in environment")
    process.exit(1)
  }

  const payload = buildImplementWebhookPayload({ source, analysis })

  const result = await postCursorAutomationWebhook({
    url,
    token: cursorAutomationQaImplementAuthToken(),
    body: payload,
  })
  if (!result.ok) {
    console.error(
      `Implement webhook failed: ${
        "status" in result
          ? `HTTP ${result.status}${result.detail ? ` — ${result.detail}` : ""}`
          : result.reason
      }`
    )
    process.exit(1)
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        chained: true,
        session_id: analysis.session_id,
        idempotency_key: payload.idempotency_key,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
