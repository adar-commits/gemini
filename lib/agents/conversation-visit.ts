/** A silence this long between messages starts a new customer visit in the same thread. */
export const NEW_VISIT_GAP_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000
const ANCHOR_MAX_CHARS = 80

export type TimedMessage = {
  role: "user" | "assistant"
  content: string
  at: string | null
}

export type ConversationVisit = {
  /** Whole days of silence before the current visit. */
  gapDays: number
  /** ISO time of the last message of the previous visit. */
  previousVisitAt: string
  /** First customer message of the current visit, when already in history. */
  anchor: string | null
  /** No bot or rep reply since the boundary — this turn opens the visit. */
  fresh: boolean
}

function timeOf(at: string | null) {
  if (!at) return null
  const ms = Date.parse(at)
  return Number.isFinite(ms) ? ms : null
}

function isMeaningfulCustomerText(message: TimedMessage) {
  const text = message.content.trim()
  return message.role === "user" && text.length > 0 && !/^\d{5,}$/.test(text)
}

/** Latest visit boundary in a time-ordered thread (oldest → newest). */
export function resolveConversationVisit(
  messages: TimedMessage[],
  now: Date = new Date()
): ConversationVisit | null {
  const timed = messages.filter((message) => timeOf(message.at) != null)
  if (!timed.length) return null

  const last = timed[timed.length - 1]
  const lastMs = timeOf(last.at)!
  if (now.getTime() - lastMs >= NEW_VISIT_GAP_DAYS * DAY_MS) {
    return {
      gapDays: Math.floor((now.getTime() - lastMs) / DAY_MS),
      previousVisitAt: last.at!,
      anchor: null,
      fresh: true,
    }
  }

  for (let index = timed.length - 1; index > 0; index -= 1) {
    const prevMs = timeOf(timed[index - 1].at)!
    const curMs = timeOf(timed[index].at)!
    if (curMs - prevMs < NEW_VISIT_GAP_DAYS * DAY_MS) continue
    const visitMessages = timed.slice(index)
    const opener = visitMessages.find(isMeaningfulCustomerText)
    return {
      gapDays: Math.floor((curMs - prevMs) / DAY_MS),
      previousVisitAt: timed[index - 1].at!,
      anchor: opener ? opener.content.trim().replace(/\s+/g, " ").slice(0, ANCHOR_MAX_CHARS) : null,
      fresh: !visitMessages.some((message) => message.role === "assistant"),
    }
  }
  return null
}
