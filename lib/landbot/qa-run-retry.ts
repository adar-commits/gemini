import {
  getQaAutomationRunById,
  updateQaAutomationRun,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import {
  shouldChainQaImplement,
  type QaAnalysis,
  type QaFixLayer,
} from "@/lib/hom-agent/qa-analysis"
import { chainQaImplement } from "@/lib/landbot/qa-chain-implement"
import {
  buildCursorAutomationQaPayload,
  cursorAutomationQaAnalyzeWebhookUrl,
  postCursorAutomationQaAnalyzeWebhook,
  type CursorAutomationQaTrigger,
} from "@/lib/landbot/cursor-automation-qa"

export type QaRunRetryTarget = "analyze" | "implement"

const TRIGGERS = new Set<CursorAutomationQaTrigger>([
  "human_assign",
  "reset",
  "closed_unanswered",
  "bot_failure",
])

const FIX_LAYERS = new Set<QaFixLayer>([
  "prompt",
  "hints",
  "tool_guard",
  "pre_turn",
  "runtime",
])

const NO_RETRY_OUTCOMES = new Set([
  "implemented",
  "vanished",
  "ignored",
  "false_alarm",
  "already_covered",
  "no_action",
])

function isTrigger(value: string): value is CursorAutomationQaTrigger {
  return TRIGGERS.has(value as CursorAutomationQaTrigger)
}

export function analysisFromQaRun(run: QaAutomationRunRow): QaAnalysis | null {
  if (!run.root_cause?.trim()) return null
  if (!isTrigger(run.trigger)) return null
  if (run.verdict !== "real_failure") return null
  if (run.confidence !== "high" && run.confidence !== "medium" && run.confidence !== "low") {
    return null
  }

  const fixLayer =
    run.fix_layer && FIX_LAYERS.has(run.fix_layer as QaFixLayer)
      ? (run.fix_layer as QaFixLayer)
      : undefined

  return {
    session_id: run.session_id,
    conversation_url: run.conversation_url,
    trigger: run.trigger,
    verdict: "real_failure",
    confidence: run.confidence,
    root_cause: run.root_cause.trim(),
    ...(fixLayer ? { fix_layer: fixLayer } : {}),
    ...(run.fix_plan.length ? { fix_plan: run.fix_plan } : {}),
    ...(run.operator_questions.length
      ? { operator_questions: run.operator_questions }
      : {}),
    analyzed_at: run.updated_at,
  }
}

export function resolveQaRunRetryTarget(run: QaAutomationRunRow): QaRunRetryTarget | null {
  if (NO_RETRY_OUTCOMES.has(run.outcome)) return null

  if (run.phase === "implement") return "implement"

  const analysis = analysisFromQaRun(run)
  if (analysis && shouldChainQaImplement(analysis)) return "implement"

  return "analyze"
}

export function qaRunRetryLabel(target: QaRunRetryTarget) {
  return target === "analyze" ? "שלח שוב לניתוח (Grok)" : "שלח שוב ליישום (Composer)"
}

function retryIdempotencyKey(run: QaAutomationRunRow) {
  const base = run.idempotency_key?.trim() || `${run.session_id}:${run.trigger}`
  return `${base}:retry:${Date.now()}`
}

async function retryAnalyze(run: QaAutomationRunRow) {
  if (!cursorAutomationQaAnalyzeWebhookUrl()) {
    return { ok: false as const, error: "missing_analyze_url" }
  }
  if (!isTrigger(run.trigger)) {
    return { ok: false as const, error: "invalid_trigger" }
  }

  const payload = buildCursorAutomationQaPayload({
    sessionId: run.session_id,
    landbotCustomerId: run.landbot_customer_id,
    trigger: run.trigger,
    idempotencyKey: retryIdempotencyKey(run),
  })

  const result = await postCursorAutomationQaAnalyzeWebhook(payload)
  if (!result.ok) {
    const operatorNotes =
      "status" in result
        ? `Retry analyze failed: HTTP ${result.status}${result.detail ? ` — ${result.detail}` : ""}`
        : `Retry analyze failed: ${result.reason}`

    await updateQaAutomationRun({
      id: run.id,
      outcome: "webhook_failed",
      operatorNotes,
    })

    return { ok: false as const, error: operatorNotes }
  }

  await updateQaAutomationRun({
    id: run.id,
    outcome: "triggered",
    operatorNotes: "Retry — analyze webhook sent.",
  })

  return { ok: true as const, target: "analyze" as const }
}

async function retryImplement(run: QaAutomationRunRow) {
  const analysis = analysisFromQaRun(run)
  if (!analysis) {
    return { ok: false as const, error: "missing_analysis_for_implement" }
  }

  const source = buildCursorAutomationQaPayload({
    sessionId: run.session_id,
    landbotCustomerId: run.landbot_customer_id,
    trigger: run.trigger as CursorAutomationQaTrigger,
    idempotencyKey: retryIdempotencyKey(run),
  })

  const result = await chainQaImplement({ analysis, source })

  if (!result.ok) {
    const operatorNotes =
      result.chained && result.reason === "implement_webhook_failed"
        ? `Retry implement failed: HTTP ${result.status ?? "?"}${result.detail ? ` — ${result.detail}` : ""}`
        : result.reason === "missing_implement_url" || result.reason === "missing_implement_token"
          ? `Retry implement failed: ${result.reason}`
          : "Retry implement skipped — analysis not approved for implement."

    await updateQaAutomationRun({
      id: run.id,
      outcome: result.chained ? "webhook_failed" : run.outcome,
      operatorNotes,
    })

    return { ok: false as const, error: operatorNotes }
  }

  if (!result.chained) {
    return { ok: false as const, error: "not_approved_for_implement" }
  }

  await updateQaAutomationRun({
    id: run.id,
    outcome: "chained",
    operatorNotes: "Retry — implement webhook accepted.",
  })

  return { ok: true as const, target: "implement" as const }
}

export async function retryQaAutomationRun(id: string) {
  const run = await getQaAutomationRunById(id)
  if (!run) return { ok: false as const, error: "not_found" }

  const target = resolveQaRunRetryTarget(run)
  if (!target) return { ok: false as const, error: "not_retryable" }

  if (target === "analyze") return retryAnalyze(run)
  return retryImplement(run)
}
