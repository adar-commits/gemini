export type LandbotInboundMessage = {
  customerId: number
  conversationId: string
  body: string
  messageKey: string
  senderType: string
  phone: string
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function asText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(asText(value))
  return Number.isFinite(n) ? n : null
}

export function parseLandbotWebhook(
  payload: unknown,
  sentryTrace: string | null
): LandbotInboundMessage | null {
  const root = asRecord(payload)
  if (!root) return null

  const messages = Array.isArray(root.messages)
    ? root.messages
    : Array.isArray(asRecord(root.body)?.messages)
      ? (asRecord(root.body)?.messages as unknown[])
      : []

  const first = asRecord(messages[0])
  if (!first) return null

  const sender = asRecord(first.sender)
  const customer = asRecord(first.customer)
  const data = asRecord(first.data)
  const raw = asRecord(first._raw)
  const senderType = asText(sender?.type).toLowerCase()
  const customerId = asNumber(customer?.id) ?? asNumber(sender?.id)
  if (!customerId) return null

  const body =
    asText(data?.body) ||
    asText(raw?.message) ||
    asText(first.body)

  const messageKey =
    asText(raw?.uuid) ||
    asText(sentryTrace) ||
    `${customerId}:${asText(first.timestamp)}:${body}`

  const customFields = asRecord(customer?.custom_fields)
  const phone =
    asText(customer?.phone) || asText(asRecord(customFields?.phone)?.value)

  return {
    customerId,
    conversationId: String(customerId),
    body,
    messageKey,
    senderType,
    phone,
  }
}

export function isCustomerChat(message: LandbotInboundMessage) {
  return message.senderType === "customer" && Boolean(message.body)
}
