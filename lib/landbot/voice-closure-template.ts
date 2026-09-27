/**
 * Voice-closure WhatsApp template sent by the dashboard (landbot repo,
 * lib/conversations/voice-closure-whatsapp-template.ts) after a phone callback request.
 * It promises a human rep ("כאן נציג/ה ... בהמשך לבקשתך לדבר עם נציג"), so the customer's
 * reply belongs to human service — the bot must not answer it.
 * Keep the id/body in sync with the landbot constants.
 */
export const VOICE_CLOSURE_TEMPLATE_ID = "986164396"

export const VOICE_CLOSURE_TEMPLATE_BODY =
  "היי 👋, כאן נציג/ה משירות הלקוחות של השטיח האדום פונה אליך בהמשך לבקשתך לדבר עם נציג, איך אוכל לעזור?"

export type OutgoingMessageRow = {
  message_type?: string | null
  body?: string | null
  payload?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function isVoiceClosureTemplateMessage(row: OutgoingMessageRow | null | undefined) {
  if (!row) return false
  const template = asRecord(asRecord(row.payload)?.template)
  const templateId = template?.id
  if (templateId != null && String(templateId).trim() === VOICE_CLOSURE_TEMPLATE_ID) {
    return true
  }
  const body = typeof row.body === "string" ? normalize(row.body) : ""
  return Boolean(body) && body === normalize(VOICE_CLOSURE_TEMPLATE_BODY)
}
