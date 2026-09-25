import {
  getQaAutomationRunById,
  updateQaAutomationRun,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import {
  buildCursorAutomationQaPayload,
  cursorAutomationQaAuthToken,
  cursorAutomationQaWebhookUrl,
  postCursorAutomationQaWebhook,
  qaEventWindowPayloadFields,
  type CursorAutomationQaTrigger,
} from "@/lib/landbot/cursor-automation-qa"
import { resolveQaEventWindow } from "@/lib/landbot/qa-event-window"

const TRIGGERS = new Set<CursorAutomationQaTrigger>([
  "human_assign",
  "reset",
  "closed_unanswered",
  "bot_failure",
  "manual",
])

const NO_RETRY_OUTCOMES = new Set([
  "implemented",
  "vanished",
  "ignored",
  "false_alarm",
  "already_covered",
  "no_action",
])

export const QA_RUN_RETRY_LABEL = "שלח שוב לאוטומציה"

function isTrigger(value: string): value is CursorAutomationQaTrigger {
  return TRIGGERS.has(value as CursorAutomationQaTrigger)
}

export function canRetryQaRun(run: QaAutomationRunRow) {
  return !NO_RETRY_OUTCOMES.has(run.outcome) && isTrigger(run.trigger)
}

function retryIdempotencyKey(run: QaAutomationRunRow) {
  const base = run.idempotency_key?.trim() || `${run.session_id}:${run.trigger}`
  return `${base}:retry:${Date.now()}`
}

export async function retryQaAutomationRun(id: string) {
  const run = await getQaAutomationRunById(id)
  if (!run) return { ok: false as const, error: "not_found" }
  if (!canRetryQaRun(run)) return { ok: false as const, error: "not_retryable" }
  if (!cursorAutomationQaWebhookUrl()) {
    return { ok: false as const, error: "missing CURSOR_AUTOMATION_QA_WEBHOOK_URL" }
  }
  if (!cursorAutomationQaAuthToken()) {
    return { ok: false as const, error: "missing CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN" }
  }

  const eventWindow = await resolveQaEventWindow(run.session_id).catch(() => null)

  const payload = buildCursorAutomationQaPayload({
    sessionId: run.session_id,
    landbotCustomerId: run.landbot_customer_id,
    trigger: run.trigger as CursorAutomationQaTrigger,
    idempotencyKey: retryIdempotencyKey(run),
    ...qaEventWindowPayloadFields(eventWindow),
  })

  const result = await postCursorAutomationQaWebhook(payload)
  if (!result.ok) {
    const operatorNotes =
      "status" in result
        ? `Retry failed: HTTP ${result.status}${result.detail ? ` — ${result.detail}` : ""}`
        : `Retry failed: ${result.reason}`

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
    operatorNotes: "Retry — automation webhook sent.",
  })

  return { ok: true as const }
}
