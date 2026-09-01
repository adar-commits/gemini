/** Customer-facing order status copy — synced with order status terminology.csv */

const APPROVED_MESSAGE =
  "ההזמנה התקבלה ואושרה לטיפול במערכת."

const PROCESSING_MESSAGE =
  "ההזמנה בטיפול במחסני החברה."

const PACKAGING_MESSAGE =
  "ההזמנה בשלב אריזה במחסני החברה."

const READY_FOR_DISPATCH_MESSAGE =
  "ההזמנה הושלמה במחסן וממתינה לשילוח."

const PICKING_MESSAGE =
  "ההזמנה בליקוט במחסני החברה."

const COMPLETED_MESSAGE =
  "ההזמנה סומנה כהושלמה במערכת."

export function buildOrderStatusMessage(orderStatusDesc?: string | null) {
  const label = String(orderStatusDesc ?? "").trim()
  if (!label) return null

  if (/מבוטל/i.test(label)) return null

  if (/מאושר/i.test(label)) return APPROVED_MESSAGE
  if (/אריז/i.test(label)) return PACKAGING_MESSAGE
  if (/ליקוט/i.test(label)) return PICKING_MESSAGE
  if (/ממתין(?:ה)?\s+ל(?:שילוח|משלוח)/i.test(label)) return READY_FOR_DISPATCH_MESSAGE
  if (/מוכנ(?:ה)?\s+ל(?:שילוח|משלוח|ליקוט)/i.test(label)) return READY_FOR_DISPATCH_MESSAGE
  if (/בטיפול/i.test(label)) return PROCESSING_MESSAGE
  if (/הושלמ|נסגר/i.test(label)) return COMPLETED_MESSAGE

  return `סטטוס ההזמנה במערכת: ${label}.`
}
