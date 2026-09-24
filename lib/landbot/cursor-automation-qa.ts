import { insertQaAutomationRun } from "@/lib/agents/qa-automation-log"
import { findCrmConversation } from "@/lib/crm/conversation-lookup"

export type CursorAutomationQaTrigger = "human_assign" | "reset" | "closed_unanswered" | "bot_failure"

export type CursorAutomationQaPayload = {
  conversation_url: string
  session_id: string
  landbot_customer_id: string | null
  trigger: CursorAutomationQaTrigger
  handoff_action?: "human_service" | "human_sales"
  last_user_message?: string
  last_bot_reply?: string
  idempotency_key: string
  phone_last4?: string | null
  sent_at: string
}

const SERVICE_CONVERSATION_BASE =
  process.env.HOM_SERVICE_CONVERSATION_BASE?.trim() ||
  "https://service.hom-group.co.il/conversations"

export function cursorAutomationQaEnabled() {
  const raw = process.env.CURSOR_AUTOMATION_QA_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false
  }
  return Boolean(cursorAutomationQaAnalyzeWebhookUrl())
}

/** Legacy alias — production analyze phase (Grok automation). */
export function cursorAutomationWebhookUrl() {
  return cursorAutomationQaAnalyzeWebhookUrl()
}

/** Phase 1: Grok analyze automation. Falls back to CURSOR_AUTOMATION_WEBHOOK_URL. */
export function cursorAutomationQaAnalyzeWebhookUrl() {
  return (
    process.env.CURSOR_AUTOMATION_QA_ANALYZE_URL?.trim() ||
    process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim() ||
    ""
  )
}

/** Phase 2: Composer implement automation — chained from analyze, not from production. */
export function cursorAutomationQaImplementWebhookUrl() {
  return process.env.CURSOR_AUTOMATION_QA_IMPLEMENT_URL?.trim() || ""
}

/** Bearer token for analyze webhook (Cursor → Generate auth header). */
export function cursorAutomationQaAnalyzeAuthToken() {
  const raw =
    process.env.CURSOR_AUTOMATION_QA_ANALYZE_TOKEN?.trim() ||
    process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN?.trim() ||
    ""
  return raw.replace(/^Bearer\s+/i, "")
}

/** Bearer token for implement webhook. */
export function cursorAutomationQaImplementAuthToken() {
  const raw = process.env.CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN?.trim() || ""
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
  ])
  const selected = parts.filter((part): part is CursorAutomationQaTrigger =>
    allowed.has(part as CursorAutomationQaTrigger)
  )
  return new Set(selected.length ? selected : ["human_assign", "bot_failure"])
}

/** Per-turn dedupe for bot_failure — same session can confuse on multiple messages. */
export function buildBotFailureIdempotencyKey(
  sessionId: string,
  lastUserMessage?: string | null
) {
  const normalized = (lastUserMessage ?? "").trim().replace(/\s+/g, " ").slice(0, 160)
  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0
  }
  return `${sessionId.trim()}:bot_failure:${Math.abs(hash)}`
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

export function buildCursorAutomationQaPayload(input: {
  sessionId: string
  landbotCustomerId?: string | null
  trigger: CursorAutomationQaTrigger
  handoffAction?: "human_service" | "human_sales"
  lastUserMessage?: string
  lastBotReply?: string
  phone?: string | null
  idempotencyKey?: string
}): CursorAutomationQaPayload {
  const sessionId = input.sessionId.trim()
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
    idempotency_key:
      input.idempotencyKey ?? `${sessionId}:${input.trigger}`,
    phone_last4: phoneLastFour(input.phone),
    sent_at: new Date().toISOString(),
  }
}

export function shouldNotifyCursorAutomationQa(
  trigger: CursorAutomationQaTrigger
) {
  return cursorAutomationQaEnabled() && cursorAutomationQaTriggers().has(trigger)
}

export async function postCursorAutomationQaAnalyzeWebhook(
  payload: CursorAutomationQaPayload
) {
  return postCursorAutomationWebhook({
    url: cursorAutomationQaAnalyzeWebhookUrl(),
    token: cursorAutomationQaAnalyzeAuthToken(),
    body: payload,
  })
}

/**
 * Fire-and-forget: POST to Grok **analyze** automation (see CURSOR_AUTOMATION_QA_ANALYZE_URL).
 * Implement is chained from analyze via scripts/chain-qa-implement-webhook.ts.
 */
export function scheduleCursorAutomationQa(input: {
  conversationId: string
  trigger: CursorAutomationQaTrigger
  handoffAction?: "human_service" | "human_sales"
  lastUserMessage?: string
  lastBotReply?: string
  phone?: string | null
  idempotencyKey?: string
}) {
  if (!shouldNotifyCursorAutomationQa(input.trigger)) return

  void (async () => {
    try {
      const row = await findCrmConversation(input.conversationId)
      const sessionId = row?.session_id?.trim() || input.conversationId.trim()
      const idempotencyKey =
        input.idempotencyKey ??
        (input.trigger === "bot_failure"
          ? buildBotFailureIdempotencyKey(sessionId, input.lastUserMessage)
          : undefined)
      const payload = buildCursorAutomationQaPayload({
        sessionId,
        landbotCustomerId: row?.landbot_customer_id ?? input.conversationId,
        trigger: input.trigger,
        handoffAction: input.handoffAction,
        lastUserMessage: input.lastUserMessage,
        lastBotReply: input.lastBotReply,
        phone: input.phone,
        idempotencyKey,
      })

      const result = await postCursorAutomationQaAnalyzeWebhook(payload)

      try {
        const stageNow = new Date().toISOString()
        await insertQaAutomationRun({
          sessionId,
          landbotCustomerId: payload.landbot_customer_id,
          conversationUrl: payload.conversation_url,
          trigger: payload.trigger,
          phase: "analyze",
          outcome: result.ok ? "triggered" : "webhook_failed",
          rootCause: result.ok
            ? `Webhook sent — awaiting Grok analyze (${payload.trigger})`
            : "Webhook POST to Cursor analyze automation failed",
          idempotencyKey: payload.idempotency_key,
          stageTimestamps: result.ok
            ? { event_at: stageNow, analyze_started_at: stageNow }
            : { event_at: stageNow },
          operatorNotes:
            result.ok
              ? null
              : "status" in result
                ? `HTTP ${result.status}${result.detail ? `: ${result.detail}` : ""}`
                : result.reason,
        })
      } catch (logError) {
        console.warn("[cursor-automation-qa] dashboard log failed", {
          sessionId,
          trigger: input.trigger,
          error: logError instanceof Error ? logError.message : logError,
        })
      }

      if (!result.ok) {
        console.warn("[cursor-automation-qa] webhook failed", {
          conversationId: input.conversationId,
          sessionId,
          trigger: input.trigger,
          ...("status" in result ? { status: result.status } : { reason: result.reason }),
        })
        return
      }

      console.info("[cursor-automation-qa] webhook sent", {
        conversationId: input.conversationId,
        sessionId,
        trigger: input.trigger,
        idempotency_key: payload.idempotency_key,
      })
    } catch (error) {
      console.warn("[cursor-automation-qa] notify failed", {
        conversationId: input.conversationId,
        trigger: input.trigger,
        error: error instanceof Error ? error.message : error,
      })
    }
  })()
}
