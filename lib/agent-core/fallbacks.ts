import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type ApiFailureHandoff = "service" | "sales"

const API_FAILURE_HANDOFF_LINE: Record<ApiFailureHandoff, string> = {
  service: "האם להעביר לנציג שירות שיבדוק עבורך?",
  sales: "האם להעביר ליועץ מכירות שיבדוק עבורך?",
}

const HOLLOW_TRANSFER_RE =
  /(?:מיד\s+)?(?:נ)?עביר(?:ים|ו)?(?:\s+(?:אות(?:ך|כם)|ל(?:נציג|בדיק|טיפול|יועץ)))|(?:נ)?בדוק(?:ים|ו)?\s+(?:א(?:ת)?\s+)?(?:סטטוס|הזמנה)/i

const PROPER_HANDOFF_OFFER_RE = /(?:האם|רוצ(?:ה|ים))\s+(?:להעביר|שנעביר)/i

export function buildConfusedFallbackReply() {
  return `${CUSTOMER_HEADER}
לא לגמרי הבנתי — אפשר לפרט במילים אחרות?
או שאעביר לנציג שימשיך מכאן?`
}

/** Priority/n8n returned nothing usable — apologize and offer human handoff. */
export function buildApiFailureReply(handoff: ApiFailureHandoff = "service") {
  return `${CUSTOMER_HEADER}
נראה שיש תקלה זמנית במערכת — לא הצלחתי למשוך את המידע כרגע.
${API_FAILURE_HANDOFF_LINE[handoff]}`
}

export function isHollowOrderStatusReply(reply: string) {
  if (/בדקתי,/i.test(reply)) {
    const withoutBoilerplate = reply
      .replace(CUSTOMER_HEADER, "")
      .replace(/^בדקתי,\s*/i, "")
      .replace(/נכון לתאריך[^\n.]*/gi, "")
      .trim()
    return withoutBoilerplate.length < 24
  }

  if (!/לגבי הזמנה\s+(?:SO|IN|OV)\d+/i.test(reply)) return false
  const withoutBoilerplate = reply
    .replace(CUSTOMER_HEADER, "")
    .replace(/לגבי הזמנה[^\n]+:\s*\n?/i, "")
    .replace(/אם צריך עוד משהו[^\n]*/gi, "")
    .replace(/אפשר גם לכתוב נציג\.?/gi, "")
    .trim()
  return withoutBoilerplate.length < 24
}

export function isHollowTransferPromise(reply: string) {
  if (!HOLLOW_TRANSFER_RE.test(reply)) return false
  if (PROPER_HANDOFF_OFFER_RE.test(reply)) return false
  if (/SO\d+|IN\d+|OV\d+/i.test(reply) && /משלוח|סטטוס|בדרך|נאסף|הגיע/i.test(reply)) {
    return false
  }
  return true
}

export function coerceOperationalReply(
  reply: string,
  options?: { expectShippingData?: boolean; handoff?: ApiFailureHandoff }
) {
  const handoff = options?.handoff ?? "service"
  if (isHollowOrderStatusReply(reply)) return buildApiFailureReply(handoff)
  if (options?.expectShippingData && isHollowTransferPromise(reply)) {
    return buildApiFailureReply(handoff)
  }
  return reply
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
