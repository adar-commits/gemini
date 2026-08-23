import type { UserMediaPart, UserTurn } from "@/lib/agents/user-turn"

export type LandbotInboundMessage = {
  customerId: number
  conversationId: string
  turn: UserTurn
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

function mediaKind(type: string): UserMediaPart["kind"] | null {
  if (type === "image" || type === "audio" || type === "video" || type === "document") {
    return type
  }
  return null
}

function extractTurn(message: UnknownRecord): UserTurn | null {
  const type = asText(message.type).toLowerCase()
  const data = asRecord(message.data)
  const raw = asRecord(message._raw)

  if (type === "text" || type === "button") {
    const body =
      asText(data?.body) ||
      asText(raw?.message) ||
      asText(message.body)
    return body ? { text: body, media: [] } : null
  }

  const kind = mediaKind(type)
  if (!kind) return null

  const url = asText(data?.url) || asText(raw?.url)
  if (!url) return null

  return {
    text: asText(data?.caption),
    media: [{ kind, url, caption: asText(data?.caption) || undefined }],
  }
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
  const raw = asRecord(first._raw)
  const senderType = asText(sender?.type).toLowerCase()
  const customerId = asNumber(customer?.id) ?? asNumber(sender?.id)
  if (!customerId) return null

  const turn = extractTurn(first)
  if (!turn) return null

  const messageKey =
    asText(raw?.uuid) ||
    asText(sentryTrace) ||
    `${customerId}:${asText(first.timestamp)}:${turn.text}:${turn.media[0]?.url ?? ""}`

  const customFields = asRecord(customer?.custom_fields)
  const phone =
    asText(customer?.phone) || asText(asRecord(customFields?.phone)?.value)

  return {
    customerId,
    conversationId: String(customerId),
    turn,
    messageKey,
    senderType,
    phone,
  }
}

export function isCustomerChat(message: LandbotInboundMessage) {
  return (
    message.senderType === "customer" &&
    (Boolean(message.turn.text.trim()) || message.turn.media.length > 0)
  )
}
