/** Customer-facing delivery status copy — synced with delivery status terminology.csv */

const IN_TRANSIT_MESSAGE =
  "המשלוח נארז ונאסף מהמחסנים, צפוי להגיע בימים הקרובים. התיאום יתבצע על ידי השליח ביום האספקה."

const PICKUP_READY_MESSAGE = `איזה כיף! ההזמנה מוכנה לאיסוף עצמי.
ניתן לאסוף את ההזמנה בכתובת: כנרת 10, איירפורט סיטי
בין השעות: 08:00-15:45 ניתן להתקשר מראש למספר 0533702089 בימים ראשון עד חמישי בלבד.`

const PROCESSING_NOT_SENT_MESSAGE =
  "ההזמנה עדיין בטיפול וטרם הועברה לחברת השליחויות."

const PACKED_AWAITING_COURIER_MESSAGE =
  "השטיח נארז במחסני החברה וממתין לאיסוף של חברת השליחויות"

const PICKUP_PROCESSING_MESSAGE =
  "ההזמנה עדיין בטיפול וטרם מוכנה לאיסוף עצמי."

const SELF_PICKUP_COLLECTED_MESSAGE =
  "ההזמנה סומנה כנאספה באופן עצמאי ממחסני החברה."

const UNKNOWN_STATUS_MESSAGE =
  "ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול."

/** Codes 3, 4, 5, 80 share the same customer explanation. */
const IN_TRANSIT_STATUS_CODES = new Set(["3", "4", "5", "80"])

function deliveredByCourierMessage(deliveryDate?: string | null) {
  if (deliveryDate?.trim()) {
    return `המשלוח סומן כנמסר באמצעות שליח בתאריך ${deliveryDate.trim()}.`
  }
  return "המשלוח סומן כנמסר באמצעות שליח."
}

export function buildDeliveryStatusMessage(input: {
  deliveryStatusId: string | number
  deliveryStatusDesc?: string
  deliveryDate?: string | null
}) {
  const statusId = String(input.deliveryStatusId ?? "").trim()

  if (IN_TRANSIT_STATUS_CODES.has(statusId)) return IN_TRANSIT_MESSAGE
  if (statusId === "22") return PICKUP_READY_MESSAGE
  if (statusId === "21") return PICKUP_PROCESSING_MESSAGE
  if (statusId === "6") return deliveredByCourierMessage(input.deliveryDate)
  if (statusId === "23") return SELF_PICKUP_COLLECTED_MESSAGE
  if (statusId === "1") return PROCESSING_NOT_SENT_MESSAGE
  if (statusId === "2") return PACKED_AWAITING_COURIER_MESSAGE
  if (/משלוח\s+נוצר|ממתין\s+לאיסוף\s+ש(?:ל|ל)?(?:חברת\s+)?(?:ה)?שליח/i.test(input.deliveryStatusDesc ?? "")) {
    return PACKED_AWAITING_COURIER_MESSAGE
  }

  return UNKNOWN_STATUS_MESSAGE
}
