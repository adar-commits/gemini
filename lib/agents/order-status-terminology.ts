/** Customer-facing order status copy — synced with order status terminology.csv (Sheet2). */

const ORDER_STATUS_COPY: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /בליקוט/i,
    message: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  },
  {
    pattern: /העברה\s+מסניף/i,
    message: "ההזמנה נשלחה מסניף וממתינה להגעתה למחסני החברה עבור משלוח.",
  },
  {
    pattern: /לוקט/i,
    message: "ההזמנה נארזה וכעת ממתינה לאיסוף על ידי חברת השליחויות.",
  },
  {
    pattern: /מאושר\s+לביצוע/i,
    message: "ההזמנה התקבלה וכעת בתהליכי אריזה במחסני החברה.",
  },
  {
    pattern: /מבוטל/i,
    message: "ההזמנה מסומנת כבוטלה.",
  },
  {
    pattern: /הושלם|נמסר/i,
    message: "ההזמנה מסומנת כנמסרה ליעדה בהצלחה.",
  },
]

export function buildOrderStatusMessage(orderStatusDesc?: string | null) {
  const label = String(orderStatusDesc ?? "").trim()
  if (!label) return null

  for (const entry of ORDER_STATUS_COPY) {
    if (entry.pattern.test(label)) return entry.message
  }

  return `סטטוס ההזמנה במערכת: ${label}.`
}
