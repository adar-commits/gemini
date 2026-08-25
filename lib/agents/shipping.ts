import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isCustomerServiceOpener } from "@/lib/agents/customer-service-opener"

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

/** Existing-order delivery status, tracking, or delay complaint. */
export function isShippingStatusQuestion(body: string) {
  const text = body.trim()
  if (!text) return false

  if (isShippingPolicyQuestion(text)) return false
  if (isCustomerServiceOpener(text)) return false

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
    /where\s+is\s+my\s+(order|shipment|package)/i.test(text)
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
השליח יתאם איתך טלפונית את מועד האספקה.`
}

export function buildShippingStatusReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק מתי המשלוח/ההזמנה שלך יגיע, אני צריך פרטי הזמנה — מספר הזמנה או טלפון שבו בוצעה הרכישה.
אם יש לך את הפרטים, שלח/י אותם ונמשיך. אם לא — אפשר להעביר לנציג שירות שיבדוק עבורך.`
}
