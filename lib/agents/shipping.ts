import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"
import { isDigitalDocumentRequest } from "@/lib/agents/digital-document-flow"

const PURCHASED_ITEM_RE = /(?:שטיח|פוף|מוצר|הזמנה|חבילה)/i
const DELIVERY_CONTEXT_RE =
  /(?:משלוח|אספק(?:ה|ת)|מסופק|יסופק|יגיע|מגיע|שליח|חבילה|בשנית|מחדש)/i

/** General delivery policy (times, cost, areas) — FAQ, not order lookup. */
export function isShippingPolicyQuestion(body: string) {
  const text = body.trim()
  if (!text) return false

  if (
    /כמה\s+(?:ימים|זמן)\s+(?:לוקח|נמשך)\s+(?:ה)?משלוח/i.test(text) ||
    /זמ(?:ן|ני)\s+(?:אספקה|משלוח)/i.test(text) ||
    /(?:מה|כמה)\s+(?:עולה|עלות)\s+(?:ה)?משלוח/i.test(text) ||
    /משלוח\s+חינם/i.test(text) ||
    /(?:אזור(?:י|י)?|עד\s+איפה)\s+(?:ה)?(?:משלוח|אספקה)/i.test(text)
  ) {
    return true
  }

  return false
}

function hasDeliveryTrackingIntent(text: string) {
  if (/איפה\s+(?:ה)?(?:שטיח|פוף|מוצר|הזמנה|חבילה)/i.test(text)) return true

  if (/מתי\s+(?:זה\s+)?(?:יסופק|ת(?:יס)?ופק|יגיע|מגיע|אספק)/i.test(text)) return true

  if (/שליח\s+צלצל/i.test(text) && DELIVERY_CONTEXT_RE.test(text)) return true

  if (/(?:היה\s+אמור|אמור\s+להיות)\s+(?:מסופק|מ(?:גיע|סופק))/i.test(text)) {
    return true
  }

  if (
    /יסופק\s+בשנית|(?:ל)?ת(?:אם|אם)\s+מחדש\s+(?:א(?:ספק|ספקה)|משלוח)/i.test(text)
  ) {
    return true
  }

  if (
    /(?:קניתי|הזמנתי)/i.test(text) &&
    /(?:איפה|מתי)/i.test(text) &&
    (PURCHASED_ITEM_RE.test(text) || DELIVERY_CONTEXT_RE.test(text))
  ) {
    return true
  }

  if (
    /(?:הזמנתי|קניתי)/i.test(text) &&
    /(?:לא\s+קיבלתי|עדיין\s+לא\s+(?:קיבל|הגיע)|טרם\s+(?:קיבל|הגיע))/i.test(text) &&
    (DELIVERY_CONTEXT_RE.test(text) || PURCHASED_ITEM_RE.test(text) || /הזמנה/i.test(text))
  ) {
    return true
  }

  if (
    /(?:הזמנתי|קניתי)/i.test(text) &&
    /לפני\s+(?:\d+\s+)?(?:י(?:מ)?(?:ים)?|שבוע(?:יים)?|חודש(?:יים)?)/i.test(text) &&
    /(?:לא\s+קיבל|עדיין\s+לא|טרם)/i.test(text) &&
    (DELIVERY_CONTEXT_RE.test(text) || /משלוח|הזמנה/i.test(text))
  ) {
    return true
  }

  if (/(?:עדיין\s+)?לא\s+קיבלתי\s+(?:את\s+)?(?:ה)?(?:משלוח|הזמנה)/i.test(text)) {
    return true
  }

  if (/מה\s+קורה\s+ע(?:ם|im)\s+(?:ה)?(?:משלוח|הזמנה|חבילה|אספקה)/i.test(text)) {
    return true
  }

  if (/(?:ע(?:וד\s+)?)?לא\s+יצא\s+(?:ל)?(?:הפצה|משלוח|לשליח)/i.test(text)) {
    return true
  }

  if (/(?:למה|יש)\s+עיכוב\s+(?:ע(?:ם|im)\s+)?(?:ה)?(?:משלוח|האספקה|אספקה)/i.test(text)) {
    return true
  }

  return false
}

/** Customer wants to schedule/coordinate delivery — bot cannot do this (courier calls customer). */
export function isDeliverySchedulingRequest(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isShippingStatusQuestion(text)) return false
  if (isShippingPolicyQuestion(text)) return false

  return (
    /(?:אשמח|רוצ(?:ה|ים|ות)|(?:אפשר|צריך|מ(?:בקש|עונ(?:י|ים|ות))))\s*(?:ל)?ת(?:אם|יאם)\s+(?:משלוח|א(?:ספקה|ספק)|מועד)/i.test(
      text
    ) ||
    /(?:ל)?ת(?:אם|יאם)\s+(?:משלוח|א(?:ספקה|ספק))(?:\s+(?:ל|ש(?:ל|ל)?)(?:שטיח|פוף|הזמנה|מוצר))?/i.test(
      text
    ) ||
    /(?:ל)?ת(?:אם|יאם)\s+.*?משלוח/i.test(text)
  )
}

/** Existing-order delivery status, tracking, or delay complaint. */
export function isShippingStatusQuestion(body: string) {
  const text = body.trim()
  if (!text) return false

  if (isShippingPolicyQuestion(text)) return false
  if (isCustomerServiceOpener(text)) return false
  if (isDigitalDocumentRequest(text)) return false

  if (
    /איפה\s+(?:ה)?(?:משלוח|הזמנה|חבילה)/i.test(text) ||
    /סטטוס\s+(?:ה)?(?:משלוח|הזמנה)/i.test(text) ||
    /מעקב\s+(?:אחרי\s+)?(?:ה)?(?:משלוח|חבילה|הזמנה)/i.test(text) ||
    /(?:ה)?(?:משלוח|הזמנה|חבילה)\s+שלי/i.test(text) ||
    /מתי\s+(?:זה\s+)?(?:יגיע|מגיע|אמור\s+ל(?:הגיע|הגיע))/i.test(text) ||
    /(?:ה)?(?:משלוח|אספקה).*(?:מ\s*\d|עד\s+\d|איחור|מאחר|delay)/i.test(text) ||
    /(?:היה\s+כתוב|מובטח).*(?:אספקה|משלוח)/i.test(text) ||
    /(?:ה)?זמנה.*(?:מ(?:אחר|ש(?:ך|כה))|איחור)/i.test(text) ||
    /לפני\s+\d+\s+י(?:מ)?(?:ים)?.*(?:מ(?:אחר|ש(?:ך|כה))|עדיין|לא)/i.test(text) ||
    /מ(?:אחר|ש(?:ך|כה))\s+מ/i.test(text) ||
    /where\s+is\s+my\s+(order|shipment|package)/i.test(text) ||
    hasDeliveryTrackingIntent(text)
  ) {
    return true
  }

  return false
}

export function buildShippingPolicyReply() {
  return `${CUSTOMER_HEADER}
לשטיחים ולפופים ל-self assembly: עד 4 ימי עסקים ממועד אישור התשלום (לא כולל שישי, שבת וחגים). הזמנות אחרי 12:00 נספרות מהיום העסקים הבא.
לפופים מוכנים: עד 14 ימי עסקים.
משלוח בית חינם לשטיחים ולפופים ל-self assembly בקנייה מעל 199 ₪; מתחת ל-199 ₪ — 29.90 ₪. פופ מוכן — 100 ₪.
השירות בין קרית גת לזכרון יעקב; ייתכן עיכוב ביישובים מרוחקים.
השליח יתאם איתכם טלפונית את מועד האספקה.`
}

export function buildShippingStatusReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק מתי המשלוח/ההזמנה שלכם יגיע, אני צריך פרטי הזמנה — מספר הזמנה או טלפון שבו בוצעה הרכישה.
אם יש לכם את הפרטים, שלחו אותם ואמשיך. אם לא — אפשר להעביר לנציג שירות שיבדוק עבורכם.`
}

/** Order/shipment status from live lookup — not a general shipping-policy FAQ. */
export function isOrderStatusLookupReply(text: string) {
  return (
    /בדקתי(?:\s+את\s+ההזמנה)?[,–—-]/i.test(text) ||
    (/בדקתי/i.test(text) && /נכון לתאריך/i.test(text)) ||
    /לגבי הזמנה\s+(?:SO|IN|OV)\d+/i.test(text)
  )
}

const APPENDED_DELIVERY_POLICY_LINE_RE =
  /^(?:זמן האספקה|לשטיחים ולפופים|לפופים מוכנים|משלוח בית חינם|השירות בין קרית גת)/i

/** Remove general SLA policy lines LLMs sometimes append after order status — often misleading. */
export function stripAppendedDeliveryPolicyFromOrderStatus(text: string) {
  if (!isOrderStatusLookupReply(text)) return text

  const lines = text.split("\n").filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (APPENDED_DELIVERY_POLICY_LINE_RE.test(trimmed)) return false
    if (/עד \d+ ימי עסקים.*(?:אישור התשלום|ממועד אישור)/i.test(trimmed)) return false
    if (/פירוק.{0,16}הרכבה.*ימי עסקים/i.test(trimmed)) return false
    if (/self assembly/i.test(trimmed) && /ימי עסקים/i.test(trimmed)) return false
    return true
  })

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}
