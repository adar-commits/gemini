import type { UserMediaPart, UserTurn } from "@/lib/agents/user-turn"

export type LandbotCustomerMessage = {
  kind: "customer"
  customerId: number
  conversationId: string
  turn: UserTurn
  messageKey: string
  senderType: string
  phone: string
  customerName: string
  assignedAgentId: number | null
}

export type LandbotAgentMessage = {
  kind: "agent"
  customerId: number
  conversationId: string
  messageKey: string
  agentId: number | null
}

export type LandbotEventMessage = {
  kind: "event"
  customerId: number
  conversationId: string
  messageKey: string
  action: "assign" | "unassign"
  agentId: number | null
}

export type LandbotHookMessage =
  | LandbotCustomerMessage
  | LandbotAgentMessage
  | LandbotEventMessage

/** @deprecated Use LandbotCustomerMessage — kept for callers that only handle customer turns. */
export type LandbotInboundMessage = LandbotCustomerMessage

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

function extractMessages(payload: unknown) {
  const root = asRecord(payload)
  if (!root) return []

  return Array.isArray(root.messages)
    ? root.messages
    : Array.isArray(asRecord(root.body)?.messages)
      ? (asRecord(root.body)?.messages as unknown[])
      : []
}

function baseMessageKey(
  first: UnknownRecord,
  raw: UnknownRecord | null,
  sentryTrace: string | null,
  suffix: string
) {
  return (
    asText(raw?.uuid) ||
    asText(sentryTrace) ||
    `${asText(first.timestamp)}:${suffix}`
  )
}

function customerFields(customer: UnknownRecord | null) {
  const customFields = asRecord(customer?.custom_fields)
  return {
    phone: asText(customer?.phone) || asText(asRecord(customFields?.phone)?.value),
    customerName: asText(customer?.name) || asText(customer?.first_name),
    assignedAgentId: asNumber(customer?.agent_id),
  }
}

export function parseLandbotHookMessage(
  payload: unknown,
  sentryTrace: string | null
): LandbotHookMessage | null {
  const first = asRecord(extractMessages(payload)[0])
  if (!first) return null

  const sender = asRecord(first.sender)
  const customer = asRecord(first.customer)
  const raw = asRecord(first._raw)
  const senderType = asText(sender?.type).toLowerCase()
  const customerId = asNumber(customer?.id) ?? asNumber(sender?.id)
  if (!customerId) return null

  const conversationId = String(customerId)
  const { phone, customerName, assignedAgentId } = customerFields(customer)
  const messageType = asText(first.type).toLowerCase()

  if (messageType === "event" || senderType === "sys") {
    const action = asText(first.action || raw?.action).toLowerCase()
    if (action !== "assign" && action !== "unassign") return null
    const agentId =
      asNumber(first.agent_id) ??
      asNumber(raw?.agent_id) ??
      asNumber(raw?.message) ??
      asNumber(first.message)
    return {
      kind: "event",
      customerId,
      conversationId,
      messageKey: baseMessageKey(first, raw, sentryTrace, `event:${action}`),
      action,
      agentId,
    }
  }

  if (senderType === "agent") {
    const agentId = asNumber(sender?.id) ?? assignedAgentId
    return {
      kind: "agent",
      customerId,
      conversationId,
      messageKey: baseMessageKey(first, raw, sentryTrace, `agent:${agentId ?? "unknown"}`),
      agentId,
    }
  }

  if (senderType !== "customer") return null

  const turn = extractTurn(first)
  if (!turn) return null

  return {
    kind: "customer",
    customerId,
    conversationId,
    turn,
    messageKey: baseMessageKey(
      first,
      raw,
      sentryTrace,
      `${turn.text}:${turn.media[0]?.url ?? ""}`
    ),
    senderType,
    phone,
    customerName,
    assignedAgentId,
  }
}

export function parseLandbotWebhook(
  payload: unknown,
  sentryTrace: string | null
): LandbotCustomerMessage | null {
  const parsed = parseLandbotHookMessage(payload, sentryTrace)
  return parsed?.kind === "customer" ? parsed : null
}

export function isCustomerChat(message: LandbotCustomerMessage) {
  return (
    message.senderType === "customer" &&
    (Boolean(message.turn.text.trim()) || message.turn.media.length > 0)
  )
}

export function isAgentChat(message: LandbotHookMessage): message is LandbotAgentMessage {
  return message.kind === "agent"
}

export function isLandbotEvent(message: LandbotHookMessage): message is LandbotEventMessage {
  return message.kind === "event"
}
