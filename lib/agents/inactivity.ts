import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

/** Wait after bot asks a question before "still there?" ping — default 15 minutes. */
export const INACTIVITY_PING_MS = Number(
  process.env.INACTIVITY_PING_MS ?? "900000"
)
/** Wait after ping before auto-close — default 30 minutes. */
export const INACTIVITY_CLOSE_AFTER_PING_MS = Number(
  process.env.INACTIVITY_CLOSE_AFTER_PING_MS ?? "1800000"
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
    return /עדיין\s+(?:שם|כאן)/.test(message.content)
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

/** Customer is away — not a "yes I'm here" to the ping. */
export function isInactivityUnavailableReply(body: string) {
  const text = body.trim()
  if (!text || text.length > 120) return false
  if (isInactivityStillHereReply(text)) return false
  return (
    /^(?:לא\s+)?(?:זמין|זמינה|פנוי|פנויה)(?:\s+כרגע|\s+ע(?:כשיו|כשיו))?/iu.test(text) ||
    /לא\s+(?:יכול|יכולה|בנ(?:מצא|מצאת))\s+(?:ל(?:דבר|ענות)\s+)?כרגע/iu.test(text) ||
    /(?:not\s+available|can'?t\s+(?:talk|chat|reply|respond)(?:\s+right\s+now)?|busy\s+(?:now|right\s+now)|unavailable)/iu.test(
      text
    ) ||
    /(?:מאוחר\s+יותר|אחר\s+כך|בהמשך|כשא(?:חזור|היה)\s+פנוי|אענה\s+מאוחר)/iu.test(text) ||
    /^(?:לא\s+)?(?:עכשיו|כרגע)(?:[\s,.!?]|$)/iu.test(text)
  )
}

export function buildInactivityDeferAck(customerName?: string) {
  const name = customerName?.trim()
  const prefix = name ? `${name}, ` : ""
  return `${CUSTOMER_HEADER}\n${prefix}בסדר גמור, אין לחץ 😊 כשתהיו מוכנים — פשוט שלחו הודעה ונמשיך משם.`
}

export function isInactivityDeferAckMessage(content: string) {
  return (
    /אין\s+לחץ/i.test(content) &&
    /(?:כשתהיו\s+מוכנים|שלחו\s+הודעה)/i.test(content)
  )
}

/**
 * After "עדיין כאן?" + customer says they're unavailable + bot acknowledged —
 * do not ping again until they send a new message.
 */
export function shouldSuppressInactivityWatch(history: HistoryMessage[]) {
  let pingIndex = -1
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (/עדיין\s+(?:שם|כאן)/.test(message.content)) {
      pingIndex = index
      break
    }
  }
  if (pingIndex === -1) return false

  let unavailableIndex = -1
  for (let index = pingIndex + 1; index < history.length; index += 1) {
    const message = history[index]
    if (message.role === "user" && isInactivityUnavailableReply(message.content)) {
      unavailableIndex = index
    }
  }
  if (unavailableIndex === -1) return false

  let deferAckIndex = -1
  for (let index = unavailableIndex + 1; index < history.length; index += 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (/עדיין\s+(?:שם|כאן)/.test(message.content)) continue
    deferAckIndex = index
    break
  }
  if (deferAckIndex === -1) return false

  const lastUserIndex = history.findLastIndex((message) => message.role === "user")
  return lastUserIndex < deferAckIndex
}

/** Ping / close notices — not the bot's real pending question. */
export function isInactivityAssistantMessage(content: string) {
  return (
    /עדיין\s+(?:שם|כאן)/.test(content) ||
    /נסגרה עקב אי מענה/.test(content) ||
    /ניתן לשלוח הודעה חוזרת/.test(content) ||
    isInactivityDeferAckMessage(content)
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
