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
