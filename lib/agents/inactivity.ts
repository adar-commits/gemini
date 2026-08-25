import { CUSTOMER_HEADER } from "@/lib/agents/types"

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
