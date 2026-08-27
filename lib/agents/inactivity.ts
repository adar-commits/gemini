import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

/** Wait after bot asks a question before "still there?" ping — default 180s. */
export const INACTIVITY_PING_MS = Number(
  process.env.INACTIVITY_PING_MS ?? "180000"
)
/** Wait after ping before auto-close — default 15 minutes. */
export const INACTIVITY_CLOSE_AFTER_PING_MS = Number(
  process.env.INACTIVITY_CLOSE_AFTER_PING_MS ?? "900000"
)

export function buildInactivityPingReply(customerName?: string) {
  const name = customerName?.trim()
  const line = name ? `${name}, עדיין כאן?` : "עדיין כאן?"
  return `${CUSTOMER_HEADER}\n${line}`
}

export function buildInactivityCloseReply() {
  return `${CUSTOMER_HEADER}\nהפנייה נסגרה עקב אי מענה, ניתן לשלוח הודעה חוזרת לפנייה חדשה`
}

export function isInactivityPingPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /עדיין שם/.test(message.content)
  }
  return false
}

export function isInactivityStillHereReply(body: string) {
  const text = body.trim()
  if (!text || text.length > 40) return false
  return /^(?:כן|כן\s+אני|פה|אני\s+פה|עדיין\s+פה|אני\s+כאן|כאן|yes|ok|👍)(?:[\s,.!?]*|$)/iu.test(
    text
  )
}

export function buildInactivityStillHereAck(customerName?: string) {
  const name = customerName?.trim()
  const prefix = name ? `מעולה ${name}, ` : "מעולה, "
  return `${CUSTOMER_HEADER}\n${prefix}אני כאן. איך אוכל להמשיך לעזור?`
}

/** Ping / close notices — not the bot's real pending question. */
export function isInactivityAssistantMessage(content: string) {
  return (
    /עדיין שם/.test(content) ||
    /נסגרה עקב אי מענה/.test(content) ||
    /ניתן לשלוח הודעה חוזרת/.test(content)
  )
}

export function lastNonInactivityAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
  }
  return ""
}

export function wasClosedForInactivity(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /נסגרה עקב אי מענה/.test(message.content)
  }
  return false
}
