import {
  getQaAutomationRunById,
  updateQaAutomationRun,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import {
  buildOperatorContinuationNotes,
  operatorQuestionsAnswered,
} from "@/lib/agents/qa-operator-gate"
import { shouldWaitForOperator } from "@/lib/agents/qa-autonomy-gate"
import { isQaRunWaitingForOperator } from "@/lib/agents/qa-event-stages"
import {
  buildCursorAutomationQaPayload,
  cursorAutomationQaAuthToken,
  cursorAutomationQaWebhookUrl,
  postCursorAutomationQaWebhook,
  qaEventWindowPayloadFields,
  type CursorAutomationQaTrigger,
  type QaPreviousAnalysis,
} from "@/lib/landbot/cursor-automation-qa"
import { resolveQaEventWindow } from "@/lib/landbot/qa-event-window"
import { buildQaTranscript } from "@/lib/landbot/qa-transcript"

const TRIGGERS = new Set<CursorAutomationQaTrigger>([
  "human_assign",
  "reset",
  "closed_unanswered",
  "bot_failure",
  "manual",
  "violation",
])

const NO_RETRY_OUTCOMES = new Set([
  "implemented",
  "vanished",
  "ignored",
  "false_alarm",
  "already_covered",
  "no_action",
])

const QA_OPERATOR_REPLY_MAX = 2000

function isTrigger(value: string): value is CursorAutomationQaTrigger {
  return TRIGGERS.has(value as CursorAutomationQaTrigger)
}

export function canRetryQaRun(run: QaAutomationRunRow) {
  return !NO_RETRY_OUTCOMES.has(run.outcome) && isTrigger(run.trigger)
}

/** Same key as the original event so automation stage/verdict logs update this card instead of a new row. */
function eventIdempotencyKey(run: QaAutomationRunRow) {
  return run.idempotency_key?.trim() || `${run.session_id}:${run.trigger}`
}

function previousAnalysis(run: QaAutomationRunRow): QaPreviousAnalysis | null {
  if (!run.verdict && !run.root_cause) return null
  return {
    outcome: run.outcome,
    verdict: run.verdict,
    confidence: run.confidence,
    risk_score: run.risk_score,
    root_cause: run.root_cause,
    fix_layer: run.fix_layer,
    fix_plan: run.fix_plan,
    operator_questions: run.operator_questions,
  }
}

async function resendQaEvent(
  run: QaAutomationRunRow,
  input: { operatorReplies: QaAutomationRunRow["operator_replies"]; note: string }
) {
  if (!cursorAutomationQaWebhookUrl()) {
    return { ok: false as const, error: "missing CURSOR_AUTOMATION_QA_WEBHOOK_URL" }
  }
  if (!cursorAutomationQaAuthToken()) {
    return { ok: false as const, error: "missing CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN" }
  }

  const eventWindow = await resolveQaEventWindow(run.session_id).catch(() => null)
  const transcript = await buildQaTranscript({
    conversationId: run.session_id,
    since: eventWindow?.since ?? null,
  }).catch(() => null)

  const gatePassed = operatorQuestionsAnswered({
    operator_questions: run.operator_questions,
    operator_replies: input.operatorReplies,
  })
  const payload = buildCursorAutomationQaPayload({
    sessionId: run.session_id,
    transcript,
    landbotCustomerId: run.landbot_customer_id,
    trigger: run.trigger as CursorAutomationQaTrigger,
    idempotencyKey: eventIdempotencyKey(run),
    operatorNotes: buildOperatorContinuationNotes(
      { ...run, operator_replies: input.operatorReplies },
      input.note
    ),
    operatorReplies: input.operatorReplies,
    previousAnalysis: previousAnalysis(run),
    operatorGatePassed: gatePassed,
    ...qaEventWindowPayloadFields(eventWindow),
  })

  const result = await postCursorAutomationQaWebhook(payload)
  if (!result.ok) {
    const operatorNotes =
      "status" in result
        ? `Retry failed: HTTP ${result.status}${result.detail ? ` — ${result.detail}` : ""}`
        : `Retry failed: ${result.reason}`
    await updateQaAutomationRun({ id: run.id, outcome: "webhook_failed", operatorNotes })
    return { ok: false as const, error: operatorNotes }
  }

  await updateQaAutomationRun({
    id: run.id,
    phase: "analyze",
    outcome: "triggered",
    operatorNotes: input.note,
    stageTimestamps: { event_at: new Date().toISOString() },
    operatorReplies: input.operatorReplies,
    ...(gatePassed ? { operatorQuestions: [] } : {}),
  })
  return { ok: true as const }
}

export async function retryQaAutomationRun(id: string) {
  const run = await getQaAutomationRunById(id)
  if (!run) return { ok: false as const, error: "not_found" }
  if (!canRetryQaRun(run)) return { ok: false as const, error: "not_retryable" }
  return resendQaEvent(run, {
    operatorReplies: run.operator_replies,
    note: "Retry — automation webhook sent.",
  })
}

/** Operator answers a waiting event; the automation continues from its previous analysis. */
const AUTO_APPROVE_REPLY =
  "auto-approved: implement gate passed — proceed without operator MCQs."

/** Re-send webhook with operator_gate_passed when the fix is obvious (no critical policy fork). */
export async function autoContinueObviousQaRun(run: QaAutomationRunRow) {
  if (
    shouldWaitForOperator({
      outcome: run.outcome,
      operatorQuestions: run.operator_questions,
      fixLayer: run.fix_layer,
      fixPlan: run.fix_plan,
      confidence: run.confidence,
      riskScore: run.risk_score,
    })
  ) {
    return { ok: false as const, skipped: true as const, reason: "critical_wait" as const }
  }

  const alreadyAuto = run.operator_replies.some((item) => item.text.includes("auto-approved"))
  const operatorReplies = alreadyAuto
    ? run.operator_replies
    : [
        ...run.operator_replies,
        { at: new Date().toISOString(), text: AUTO_APPROVE_REPLY },
      ]

  return resendQaEvent(run, {
    operatorReplies,
    note: "Auto-continued — obvious fix, no critical policy ambiguity.",
  })
}

export async function replyToQaAutomationRun(id: string, text: string) {
  const reply = text.trim().slice(0, QA_OPERATOR_REPLY_MAX)
  if (!reply) return { ok: false as const, error: "empty_reply" }
  const run = await getQaAutomationRunById(id)
  if (!run) return { ok: false as const, error: "not_found" }
  if (!isQaRunWaitingForOperator(run) || !isTrigger(run.trigger)) {
    return { ok: false as const, error: "not_waiting_for_operator" }
  }
  return resendQaEvent(run, {
    operatorReplies: [...run.operator_replies, { at: new Date().toISOString(), text: reply }],
    note: "Operator replied — automation continuing.",
  })
}
