import {
  buildManualQaIdempotencyKey,
  cursorAutomationQaEnabled,
  executeCursorAutomationQa,
} from "@/lib/landbot/cursor-automation-qa"
import { resolveQaConversationContext } from "@/lib/landbot/qa-conversation-context"

export type ManualQaTriggerResult =
  | {
      ok: true
      sessionId: string
      runId: string
      webhookSent: true
    }
  | {
      ok: false
      reason: "not_found" | "disabled" | "webhook_failed" | "invalid_id"
      detail?: string
      runId?: string
      sessionId?: string
    }

export async function triggerManualQaReview(
  conversationId: string,
  operatorNotes?: string | null
): Promise<ManualQaTriggerResult> {
  const trimmed = conversationId.trim()
  if (!trimmed) {
    return { ok: false, reason: "invalid_id" }
  }

  if (!cursorAutomationQaEnabled()) {
    return { ok: false, reason: "disabled" }
  }

  const context = await resolveQaConversationContext(trimmed)
  if (!context) {
    return { ok: false, reason: "not_found" }
  }

  const result = await executeCursorAutomationQa({
    conversationId: trimmed,
    trigger: "manual",
    sessionId: context.sessionId,
    landbotCustomerId: context.landbotCustomerId,
    lastUserMessage: context.lastUserMessage ?? undefined,
    lastBotReply: context.lastBotReply ?? undefined,
    phone: context.phone,
    idempotencyKey: buildManualQaIdempotencyKey(context.sessionId),
    operatorNotes,
    skipTriggerCheck: true,
  })

  if ("skipped" in result) {
    return { ok: false, reason: "disabled", detail: result.reason }
  }

  if (!result.webhook.ok) {
    const detail =
      "status" in result.webhook
        ? `HTTP ${result.webhook.status}${result.webhook.detail ? `: ${result.webhook.detail}` : ""}`
        : result.webhook.reason
    return {
      ok: false,
      reason: "webhook_failed",
      detail,
      runId: result.run.id,
      sessionId: result.sessionId,
    }
  }

  return {
    ok: true,
    sessionId: result.sessionId,
    runId: result.run.id,
    webhookSent: true,
  }
}
