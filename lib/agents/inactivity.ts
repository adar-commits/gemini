import { CUSTOMER_HEADER, type HistoryMessage } from "@/lib/agents/types"

export const INACTIVITY_PING_MS = Number(
  process.env.INACTIVITY_PING_MS ?? "60000"
)
export const INACTIVITY_CLOSE_AFTER_PING_MS = Number(
  process.env.INACTIVITY_CLOSE_AFTER_PING_MS ?? "60000"
)

export function buildInactivityPingReply(customerName?: string) {
  const name = customerName?.trim()
  const line = name ? `אתה עדיין שם ${name}?` : "אתה עדיין שם?"
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
