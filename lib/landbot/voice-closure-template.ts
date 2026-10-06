/**
 * Voice-closure WhatsApp templates sent by the dashboard (landbot repo,
 * lib/conversations/voice-closure-whatsapp-template.ts) after a phone callback request.
 * They are sent after the customer chose, on the call, to keep waiting for a rep on WhatsApp.
 * The bot still answers the customer's reply and hands off to human service when needed.
 * Keep ids/bodies in sync with the landbot constants.
 */
export const VOICE_CLOSURE_TEMPLATE_ID = "986164396"

/** Hub / Landbot template id for the WhatsApp-email-only callback variant (533657825). */
export const PHONE_CALLBACK_CLOSURE_TEMPLATE_ID = "1645285532"

/** Landbot template uuid for the same phone-callback variant. */
export const PHONE_CALLBACK_CLOSURE_TEMPLATE_UUID = "6b87d953"

export const VOICE_CLOSURE_TEMPLATE_IDS = [
  VOICE_CLOSURE_TEMPLATE_ID,
  PHONE_CALLBACK_CLOSURE_TEMPLATE_ID,
  PHONE_CALLBACK_CLOSURE_TEMPLATE_UUID,
] as const

export const VOICE_CLOSURE_TEMPLATE_BODY =
  "היי 👋, כאן נציג/ה משירות הלקוחות של השטיח האדום פונה אליך בהמשך לבקשתך לדבר עם נציג, איך אוכל לעזור?"

export const PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY =
  "היי 👋, מחלקת שירות הלקוחות שלנו פועלת ב-WhatsApp / אימייל בלבד. פונה אלייך בהמשך לשיחתך הטלפונית, איך אוכל לעזור?"

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
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function templateIdFromRow(row: OutgoingMessageRow) {
  const template = asRecord(asRecord(row.payload)?.template)
  const templateId = template?.id
  return templateId != null ? String(templateId).trim() : ""
}

function isKnownVoiceClosureTemplateId(templateId: string) {
  return VOICE_CLOSURE_TEMPLATE_IDS.includes(
    templateId as (typeof VOICE_CLOSURE_TEMPLATE_IDS)[number]
  )
}

function isVoiceClosureTemplateBody(body: string) {
  const normalized = normalize(body)
  if (!normalized) return false
  if (normalized === normalize(VOICE_CLOSURE_TEMPLATE_BODY)) return true
  if (normalized === normalize(PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY)) return true
  if (
    normalized.includes("בהמשך לבקשתך לדבר עם נציג") &&
    normalized.includes("איך אוכל לעזור")
  ) {
    return true
  }
  if (
    normalized.includes("בהמשך לשיחתך הטלפונית") &&
    normalized.includes("WhatsApp / אימייל בלבד")
  ) {
    return true
  }
  return false
}

export function voiceClosureTemplateBodyFromRow(
  row: OutgoingMessageRow | null | undefined
) {
  if (!row) return VOICE_CLOSURE_TEMPLATE_BODY
  const body = typeof row.body === "string" ? row.body.trim() : ""
  if (body && isVoiceClosureTemplateBody(body)) return body

  const templateId = templateIdFromRow(row)
  if (
    templateId === PHONE_CALLBACK_CLOSURE_TEMPLATE_ID ||
    templateId === PHONE_CALLBACK_CLOSURE_TEMPLATE_UUID
  ) {
    return PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY
  }
  return VOICE_CLOSURE_TEMPLATE_BODY
}

export function isVoiceClosureTemplateMessage(row: OutgoingMessageRow | null | undefined) {
  if (!row) return false
  const templateId = templateIdFromRow(row)
  if (templateId && isKnownVoiceClosureTemplateId(templateId)) {
    return true
  }
  const body = typeof row.body === "string" ? row.body : ""
  return isVoiceClosureTemplateBody(body)
}
