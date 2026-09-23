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
  return Boolean(cursorAutomationWebhookUrl())
}

export function cursorAutomationWebhookUrl() {
  return process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim() || ""
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

async function postCursorAutomationWebhook(payload: CursorAutomationQaPayload) {
  const url = cursorAutomationWebhookUrl()
  if (!url) return { ok: false as const, reason: "missing_webhook_url" as const }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        ok: false as const,
        reason: "http_error" as const,
        status: response.status,
      }
    }
    return { ok: true as const }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fire-and-forget: notify Cursor Automation to QA this conversation.
 * Phase 1 (week 1): human_assign only — see CURSOR_AUTOMATION_QA_TRIGGERS.
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

      const result = await postCursorAutomationWebhook(payload)
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
