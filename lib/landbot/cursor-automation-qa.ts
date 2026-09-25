import {
  getQaAutomationRunByIdempotencyKey,
  insertQaAutomationRun,
  type QaAutomationRunRow,
} from "@/lib/agents/qa-automation-log"
import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import {
  resolveQaEventWindow,
  type QaEventWindowReason,
} from "@/lib/landbot/qa-event-window"
import { buildQaTranscript } from "@/lib/landbot/qa-transcript"
import { qaCallbackToken } from "@/lib/agents/qa-callback-token"

export type CursorAutomationQaTrigger =
  | "human_assign"
  | "reset"
  | "closed_unanswered"
  | "bot_failure"
  | "manual"
  | "violation"

export type CursorAutomationQaPayload = {
  conversation_url: string
  session_id: string
  landbot_customer_id: string | null
  trigger: CursorAutomationQaTrigger
  handoff_action?: "human_service" | "human_sales"
  last_user_message?: string
  last_bot_reply?: string
  /** ISO timestamp — analyze ONLY messages at/after this time (not lifetime thread). */
  event_window_since: string
  event_window_reason: QaEventWindowReason
  event_window_message_count: number
  total_message_count: number
  idempotency_key: string
  phone_last4?: string | null
  /** Operator's own description of what went wrong (manual trigger / retry). */
  operator_notes?: string
  /** Event-window timeline + agent turns + shadow — analyze from this, no DB read needed. */
  transcript?: string
  /** Bearer for this event's dashboard callbacks (automations have no secrets store). */
  callback_token?: string
  /** Operator answers to this event's earlier questions, oldest first (last = newest reply). */
  operator_replies?: { at: string; text: string }[]
  /** The automation's previous verdict for this event — continue from it when replying. */
  previous_analysis?: QaPreviousAnalysis
  sent_at: string
}

export type QaPreviousAnalysis = {
  outcome: string
  verdict: string | null
  confidence: string | null
  risk_score: number | null
  root_cause: string | null
  fix_layer: string | null
  fix_plan: string[]
  operator_questions: string[]
}

const OPERATOR_NOTES_MAX = 2000

const SERVICE_CONVERSATION_BASE =
  process.env.HOM_SERVICE_CONVERSATION_BASE?.trim() ||
  "https://service.hom-group.co.il/conversations"

/** Cursor rejects unauthenticated webhook POSTs, so a URL without a token counts as disabled. */
export function cursorAutomationQaEnabled() {
  const raw = process.env.CURSOR_AUTOMATION_QA_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false
  }
  return Boolean(cursorAutomationQaWebhookUrl() && cursorAutomationQaAuthToken())
}

/** Single self-improve automation: QA → analyze → brief → implement. */
export function cursorAutomationQaWebhookUrl() {
  return process.env.CURSOR_AUTOMATION_QA_WEBHOOK_URL?.trim() || ""
}

/** Bearer token from the automation's "Generate auth header". */
export function cursorAutomationQaAuthToken() {
  const raw = process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN?.trim() || ""
  return raw.replace(/^Bearer\s+/i, "")
}

export function buildCursorAutomationWebhookHeaders(token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const normalized = token?.trim().replace(/^Bearer\s+/i, "")
  if (normalized) headers.Authorization = `Bearer ${normalized}`
  return headers
}

export async function postCursorAutomationWebhook(input: {
  url: string
  token?: string | null
  body: unknown
  timeoutMs?: number
}) {
  if (!input.url.trim()) {
    return { ok: false as const, reason: "missing_webhook_url" as const }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8_000)
  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: buildCursorAutomationWebhookHeaders(input.token),
      body: JSON.stringify(input.body),
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail = ""
      try {
        detail = (await response.text()).slice(0, 300)
      } catch {
        // ignore
      }
      return {
        ok: false as const,
        reason: "http_error" as const,
        status: response.status,
        detail: detail || undefined,
      }
    }
    return { ok: true as const }
  } finally {
    clearTimeout(timeout)
  }
}

/** Default: human handoff + never-stuck bot failure. Comma list, e.g. human_assign,bot_failure */
export function cursorAutomationQaTriggers(): Set<CursorAutomationQaTrigger> {
  const raw = process.env.CURSOR_AUTOMATION_QA_TRIGGERS?.trim()
  const parts = (raw || "human_assign,bot_failure")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const allowed = new Set<CursorAutomationQaTrigger>([
    "human_assign",
    "reset",
    "closed_unanswered",
    "bot_failure",
    "manual",
    "violation",
  ])
  const selected = parts.filter((part): part is CursorAutomationQaTrigger =>
    allowed.has(part as CursorAutomationQaTrigger)
  )
  return new Set(selected.length ? selected : ["human_assign", "bot_failure"])
}

/** Per-turn dedupe for bot_failure — same session can confuse on multiple messages. */
/** Manual dashboard triggers always create a fresh analyze event. */
export function buildManualQaIdempotencyKey(sessionId: string, at = Date.now()) {
  return `manual:${sessionId.trim()}:${at}`
}

/** Same turn re-delivered within this window (Landbot retries) collapses into one event. */
const EVENT_DEDUPE_BUCKET_MS = 10 * 60_000

function turnEventKey(
  sessionId: string,
  trigger: "bot_failure" | "human_assign",
  lastUserMessage: string | null | undefined,
  at: number
) {
  const normalized = (lastUserMessage ?? "").trim().replace(/\s+/g, " ").slice(0, 160)
  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0
  }
  return `${sessionId.trim()}:${trigger}:${Math.abs(hash)}:${Math.floor(at / EVENT_DEDUPE_BUCKET_MS)}`
}

export function buildBotFailureIdempotencyKey(
  sessionId: string,
  lastUserMessage?: string | null,
  at = Date.now()
) {
  return turnEventKey(sessionId, "bot_failure", lastUserMessage, at)
}

/** One event per handoff — a later handoff in the same chat is a new event. */
export function buildHandoffIdempotencyKey(
  sessionId: string,
  lastUserMessage?: string | null,
  at = Date.now()
) {
  return turnEventKey(sessionId, "human_assign", lastUserMessage, at)
}

export function buildHomServiceConversationUrl(sessionId: string) {
  const base = SERVICE_CONVERSATION_BASE.replace(/\/+$/, "")
  const id = sessionId.trim()
  return `${base}/${encodeURIComponent(id)}`
}

export function phoneLastFour(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length < 4) return null
  return digits.slice(-4)
}

export function qaEventWindowPayloadFields(window?: {
  since: string
  reason: QaEventWindowReason
  eventWindowMessageCount: number
  totalMessageCount: number
} | null) {
  return {
    eventWindowSince: window?.since ?? new Date().toISOString(),
    eventWindowReason: window?.reason ?? ("tail_fallback" as const),
    eventWindowMessageCount: window?.eventWindowMessageCount ?? 40,
    totalMessageCount: window?.totalMessageCount ?? 0,
  }
}

export function buildCursorAutomationQaPayload(input: {
  sessionId: string
  landbotCustomerId?: string | null
  trigger: CursorAutomationQaTrigger
  handoffAction?: "human_service" | "human_sales"
  lastUserMessage?: string
  lastBotReply?: string
  phone?: string | null
  idempotencyKey?: string
  operatorNotes?: string | null
  transcript?: string | null
  operatorReplies?: { at: string; text: string }[]
  previousAnalysis?: QaPreviousAnalysis | null
  eventWindowSince: string
  eventWindowReason: QaEventWindowReason
  eventWindowMessageCount: number
  totalMessageCount: number
}): CursorAutomationQaPayload {
  const sessionId = input.sessionId.trim()
  const idempotencyKey = input.idempotencyKey ?? `${sessionId}:${input.trigger}`
  const callbackToken = qaCallbackToken(idempotencyKey)
  return {
    conversation_url: buildHomServiceConversationUrl(sessionId),
    session_id: sessionId,
    landbot_customer_id: input.landbotCustomerId?.trim() || null,
    trigger: input.trigger,
    ...(input.handoffAction ? { handoff_action: input.handoffAction } : {}),
    ...(input.lastUserMessage?.trim()
      ? { last_user_message: input.lastUserMessage.trim().slice(0, 500) }
      : {}),
    ...(input.lastBotReply?.trim()
      ? { last_bot_reply: input.lastBotReply.trim().slice(0, 800) }
      : {}),
    event_window_since: input.eventWindowSince,
    event_window_reason: input.eventWindowReason,
    event_window_message_count: input.eventWindowMessageCount,
    total_message_count: input.totalMessageCount,
    idempotency_key: idempotencyKey,
    phone_last4: phoneLastFour(input.phone),
    ...(input.operatorNotes?.trim()
      ? { operator_notes: input.operatorNotes.trim().slice(0, OPERATOR_NOTES_MAX) }
      : {}),
    ...(input.transcript?.trim() ? { transcript: input.transcript } : {}),
    ...(callbackToken ? { callback_token: callbackToken } : {}),
    ...(input.operatorReplies?.length ? { operator_replies: input.operatorReplies } : {}),
    ...(input.previousAnalysis ? { previous_analysis: input.previousAnalysis } : {}),
    sent_at: new Date().toISOString(),
  }
}

export function shouldNotifyCursorAutomationQa(
  trigger: CursorAutomationQaTrigger
) {
  return cursorAutomationQaEnabled() && cursorAutomationQaTriggers().has(trigger)
}

export async function postCursorAutomationQaWebhook(
  payload: CursorAutomationQaPayload
) {
  return postCursorAutomationWebhook({
    url: cursorAutomationQaWebhookUrl(),
    token: cursorAutomationQaAuthToken(),
    body: payload,
  })
}

export type ExecuteCursorAutomationQaInput = {
  conversationId: string
  trigger: CursorAutomationQaTrigger
  handoffAction?: "human_service" | "human_sales"
  lastUserMessage?: string
  lastBotReply?: string
  phone?: string | null
  idempotencyKey?: string
  sessionId?: string
  landbotCustomerId?: string | null
  operatorNotes?: string | null
  skipTriggerCheck?: boolean
}

export type ExecuteCursorAutomationQaResult = {
  sessionId: string
  payload: CursorAutomationQaPayload
  webhook: Awaited<ReturnType<typeof postCursorAutomationQaWebhook>>
  run: QaAutomationRunRow
}

/** POST to the self-improve automation and log a dashboard row (awaitable). */
export async function executeCursorAutomationQa(
  input: ExecuteCursorAutomationQaInput
): Promise<
  | { skipped: true; reason: "disabled" | "trigger_filtered" | "duplicate" }
  | ExecuteCursorAutomationQaResult
> {
  if (!input.skipTriggerCheck && !shouldNotifyCursorAutomationQa(input.trigger)) {
    return { skipped: true, reason: "trigger_filtered" }
  }
  if (!cursorAutomationQaEnabled()) {
    return { skipped: true, reason: "disabled" }
  }

  const row = input.sessionId
    ? null
    : await findCrmConversation(input.conversationId)
  const sessionId =
    input.sessionId?.trim() ||
    row?.session_id?.trim() ||
    input.conversationId.trim()
  const idempotencyKey =
    input.idempotencyKey ??
    (input.trigger === "bot_failure"
      ? buildBotFailureIdempotencyKey(sessionId, input.lastUserMessage)
      : input.trigger === "human_assign"
        ? buildHandoffIdempotencyKey(sessionId, input.lastUserMessage)
        : input.trigger === "manual"
          ? buildManualQaIdempotencyKey(sessionId)
          : undefined)

  if (idempotencyKey && input.trigger !== "manual") {
    const existing = await getQaAutomationRunByIdempotencyKey(idempotencyKey).catch(() => null)
    if (existing) return { skipped: true, reason: "duplicate" }
  }

  let eventWindow
  try {
    eventWindow = await resolveQaEventWindow(sessionId)
  } catch (windowError) {
    console.warn("[cursor-automation-qa] event window lookup failed", {
      sessionId,
      error:
        windowError instanceof Error ? windowError.message : windowError,
    })
  }

  const transcript = await buildQaTranscript({
    conversationId: sessionId,
    since: eventWindow?.since ?? null,
  }).catch((transcriptError) => {
    console.warn("[cursor-automation-qa] transcript build failed", {
      sessionId,
      error:
        transcriptError instanceof Error ? transcriptError.message : transcriptError,
    })
    return null
  })

  const payload = buildCursorAutomationQaPayload({
    sessionId,
    transcript,
    landbotCustomerId:
      input.landbotCustomerId ?? row?.landbot_customer_id ?? input.conversationId,
    trigger: input.trigger,
    handoffAction: input.handoffAction,
    lastUserMessage: input.lastUserMessage,
    lastBotReply: input.lastBotReply,
    phone: input.phone,
    idempotencyKey,
    operatorNotes: input.operatorNotes,
    ...qaEventWindowPayloadFields(eventWindow ?? null),
  })

  const webhook = await postCursorAutomationQaWebhook(payload)
  const stageNow = new Date().toISOString()
  let run: QaAutomationRunRow

  try {
    run = await insertQaAutomationRun({
      sessionId,
      landbotCustomerId: payload.landbot_customer_id,
      conversationUrl: payload.conversation_url,
      trigger: payload.trigger,
      phase: "analyze",
      outcome: webhook.ok ? "triggered" : "webhook_failed",
      rootCause: webhook.ok
        ? input.trigger === "manual"
          ? "בדיקה ידנית — נשלח לאוטומציה"
          : `Webhook sent — awaiting automation analyze (${payload.trigger})`
        : "Webhook POST to Cursor automation failed",
      idempotencyKey: payload.idempotency_key,
      operatorInput: payload.operator_notes ?? null,
      stageTimestamps: { event_at: stageNow },
      operatorNotes: webhook.ok
        ? input.trigger === "manual"
          ? "טריגר ידני מהדשבורד"
          : null
        : "status" in webhook
          ? `HTTP ${webhook.status}${webhook.detail ? `: ${webhook.detail}` : ""}`
          : webhook.reason,
    })
  } catch (logError) {
    console.warn("[cursor-automation-qa] dashboard log failed", {
      sessionId,
      trigger: input.trigger,
      error: logError instanceof Error ? logError.message : logError,
    })
    throw logError
  }

  if (!webhook.ok) {
    console.warn("[cursor-automation-qa] webhook failed", {
      conversationId: input.conversationId,
      sessionId,
      trigger: input.trigger,
      ...("status" in webhook ? { status: webhook.status } : { reason: webhook.reason }),
    })
  } else {
    console.info("[cursor-automation-qa] webhook sent", {
      conversationId: input.conversationId,
      sessionId,
      trigger: input.trigger,
      idempotency_key: payload.idempotency_key,
    })
  }

  return { sessionId, payload, webhook, run }
}
