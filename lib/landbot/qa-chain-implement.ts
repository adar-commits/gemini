import { insertQaAutomationRun } from "@/lib/agents/qa-automation-log"
import {
  buildImplementWebhookPayload,
  parseQaAnalysis,
  shouldChainQaImplement,
  type QaAnalysis,
} from "@/lib/hom-agent/qa-analysis"
import type { CursorAutomationQaPayload } from "@/lib/landbot/cursor-automation-qa"
import {
  cursorAutomationQaImplementAuthToken,
  cursorAutomationQaImplementWebhookUrl,
  postCursorAutomationWebhook,
} from "@/lib/landbot/cursor-automation-qa"

export type ChainQaImplementInput = {
  analysis: QaAnalysis
  source?: CursorAutomationQaPayload | null
}

export type ChainQaImplementResult =
  | {
      ok: true
      chained: false
      verdict: QaAnalysis["verdict"]
      confidence: QaAnalysis["confidence"]
      reason: "needs_operator" | "not_approved_for_implement"
    }
  | {
      ok: false
      chained: false
      reason: "missing_implement_url" | "missing_implement_token"
    }
  | {
      ok: false
      chained: true
      reason: "implement_webhook_failed"
      status?: number
      detail?: string
      idempotency_key: string
    }
  | {
      ok: true
      chained: true
      session_id: string
      idempotency_key: string
    }

function defaultSource(analysis: QaAnalysis): CursorAutomationQaPayload {
  return {
    conversation_url: analysis.conversation_url,
    session_id: analysis.session_id,
    landbot_customer_id: null,
    trigger: analysis.trigger,
    idempotency_key: `${analysis.session_id}:${analysis.trigger}`,
    sent_at: analysis.analyzed_at ?? new Date().toISOString(),
  }
}

async function logChainOutcome(input: {
  analysis: QaAnalysis
  source: CursorAutomationQaPayload
  outcome: "chained" | "webhook_failed"
  operatorNotes?: string | null
  idempotencyKey: string
}) {
  try {
    await insertQaAutomationRun({
      sessionId: input.analysis.session_id,
      landbotCustomerId: input.source.landbot_customer_id,
      conversationUrl: input.analysis.conversation_url,
      trigger: input.analysis.trigger,
      phase: "analyze",
      outcome: input.outcome,
      verdict: input.analysis.verdict,
      confidence: input.analysis.confidence,
      rootCause: input.analysis.root_cause,
      fixLayer: input.analysis.fix_layer ?? null,
      fixPlan: input.analysis.fix_plan ?? [],
      operatorQuestions: input.analysis.operator_questions ?? [],
      idempotencyKey: input.idempotencyKey,
      operatorNotes: input.operatorNotes ?? null,
    })
  } catch (error) {
    console.warn("[qa-chain-implement] dashboard log failed", {
      sessionId: input.analysis.session_id,
      error: error instanceof Error ? error.message : error,
    })
  }
}

export function parseChainQaImplementBody(raw: unknown): ChainQaImplementInput | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const analysisRaw = row.analysis ?? row
  const analysis = parseQaAnalysis(analysisRaw)
  if (!analysis) return null

  let source: CursorAutomationQaPayload | null = null
  if (row.source && typeof row.source === "object") {
    const sourceRow = row.source as Record<string, unknown>
    const sessionId =
      typeof sourceRow.session_id === "string" ? sourceRow.session_id.trim() : ""
    const conversationUrl =
      typeof sourceRow.conversation_url === "string"
        ? sourceRow.conversation_url.trim()
        : ""
    const trigger = sourceRow.trigger
    if (
      sessionId &&
      conversationUrl &&
      typeof trigger === "string" &&
      (trigger === "human_assign" ||
        trigger === "bot_failure" ||
        trigger === "reset" ||
        trigger === "closed_unanswered")
    ) {
      source = {
        conversation_url: conversationUrl,
        session_id: sessionId,
        landbot_customer_id:
          typeof sourceRow.landbot_customer_id === "string"
            ? sourceRow.landbot_customer_id
            : null,
        trigger,
        idempotency_key:
          typeof sourceRow.idempotency_key === "string"
            ? sourceRow.idempotency_key
            : `${sessionId}:${trigger}`,
        sent_at:
          typeof sourceRow.sent_at === "string"
            ? sourceRow.sent_at
            : new Date().toISOString(),
        ...(typeof sourceRow.handoff_action === "string"
          ? {
              handoff_action: sourceRow.handoff_action as
                | "human_service"
                | "human_sales",
            }
          : {}),
        ...(typeof sourceRow.last_user_message === "string"
          ? { last_user_message: sourceRow.last_user_message }
          : {}),
        ...(typeof sourceRow.last_bot_reply === "string"
          ? { last_bot_reply: sourceRow.last_bot_reply }
          : {}),
        ...(typeof sourceRow.phone_last4 === "string"
          ? { phone_last4: sourceRow.phone_last4 }
          : { phone_last4: null }),
      }
    }
  }

  return { analysis, source }
}

export async function chainQaImplement(
  input: ChainQaImplementInput
): Promise<ChainQaImplementResult> {
  const { analysis } = input
  const source = input.source ?? defaultSource(analysis)

  if (!shouldChainQaImplement(analysis)) {
    return {
      ok: true,
      chained: false,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      reason:
        analysis.verdict === "ask_operator" || analysis.confidence !== "high"
          ? "needs_operator"
          : "not_approved_for_implement",
    }
  }

  const url = cursorAutomationQaImplementWebhookUrl()
  if (!url) {
    return { ok: false, chained: false, reason: "missing_implement_url" }
  }

  const token = cursorAutomationQaImplementAuthToken()
  if (!token) {
    return { ok: false, chained: false, reason: "missing_implement_token" }
  }

  const payload = buildImplementWebhookPayload({ source, analysis })
  const result = await postCursorAutomationWebhook({
    url,
    token,
    body: payload,
  })

  if (!result.ok) {
    const operatorNotes =
      "status" in result
        ? `Implement webhook failed: HTTP ${result.status}${result.detail ? ` — ${result.detail}` : ""}`
        : `Implement webhook failed: ${result.reason}`

    await logChainOutcome({
      analysis,
      source,
      outcome: "webhook_failed",
      operatorNotes,
      idempotencyKey: source.idempotency_key,
    })

    return {
      ok: false,
      chained: true,
      reason: "implement_webhook_failed",
      ...("status" in result ? { status: result.status, detail: result.detail } : {}),
      idempotency_key: payload.idempotency_key,
    }
  }

  await logChainOutcome({
    analysis,
    source,
    outcome: "chained",
    operatorNotes: "Implement webhook accepted — Composer run started.",
    idempotencyKey: source.idempotency_key,
  })

  return {
    ok: true,
    chained: true,
    session_id: analysis.session_id,
    idempotency_key: payload.idempotency_key,
  }
}

export function qaChainImplementEnvStatus() {
  return {
    implement_url: Boolean(cursorAutomationQaImplementWebhookUrl()),
    implement_token: Boolean(cursorAutomationQaImplementAuthToken()),
    analyze_url: Boolean(
      process.env.CURSOR_AUTOMATION_QA_ANALYZE_URL?.trim() ||
        process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim()
    ),
    analyze_token: Boolean(
      process.env.CURSOR_AUTOMATION_QA_ANALYZE_TOKEN?.trim() ||
        process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN?.trim()
    ),
    cron_secret: Boolean(process.env.CRON_SECRET?.trim()),
  }
}
