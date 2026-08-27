import { CUSTOMER_HEADER } from "@/lib/agents/types"

export function buildConfusedFallbackReply() {
  return `${CUSTOMER_HEADER}
לא לגמרי הבנתי — אפשר לפרט במילים אחרות?
או שאעביר לנציג שימשיך מכאן?`
}

export function buildApiFailureReply() {
  return `${CUSTOMER_HEADER}
לא הצלחתי למשוך את המידע מהמערכת כרגע.
רוצה שנעביר לנציג שירות שיעזור?`
}

export function buildThanksReply(customerName?: string) {
  const name = customerName?.trim()
  const line = name
    ? `בשמחה ${name}, כאן אם צריך עוד משהו.`
    : "בשמחה, כאן אם צריך עוד משהו."
  return `${CUSTOMER_HEADER}\n${line}`
}

export function buildLlmFailureReply() {
  return `${CUSTOMER_HEADER}
רגע, משהו נתקע בצד שלי — סליחה על זה.
אפשר לנסח שוב בקצרה, או שאעביר לנציג שימשיך מכאן?`
}

/** Last-resort customer text when the pipeline produced nothing sendable. */
export function buildNeverStuckReply() {
  return `${CUSTOMER_HEADER}
אני כאן — נראה שההודעה לא עברה כמו שצריך.
אפשר לנסות שוב, או שאעביר לנציג שירות?`
}
