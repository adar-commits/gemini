/** Customer-facing delivery status copy — synced with delivery status terminology.csv */

const LOADED_MESSAGE =
  "המשלוח נאסף על ידי חברת השליחויות ובדרך למרכז ההפצה להמשך טיפול."

const AWAITING_DISPATCH_MESSAGE =
  "המשלוח שוייך לשליח בחברת ההפצה וממתין ליציאתו אליך, התיאום יתבצע על ידי השליח ביום האספקה."

const EN_ROUTE_MESSAGE =
  "איזה כיף! המשלוח הועמס לשליח ובדרכו אליך ברגעים אלה."

const PICKUP_READY_MESSAGE = `איזה כיף! ההזמנה מוכנה לאיסוף עצמי.
ניתן לאסוף את ההזמנה בכתובת: כנרת 10, איירפורט סיטי
בין השעות: 08:00-15:45 ניתן להתקשר מראש למספר 0533702089 בימים ראשון עד חמישי בלבד.`

const PACKED_AWAITING_COURIER_MESSAGE =
  "ההזמנה נארזה ומוכנה לאיסוף על ידי חברת השליחויות."

const PICKUP_PROCESSING_MESSAGE =
  "ההזמנה עדיין בטיפול וטרם מוכנה לאיסוף עצמי."

const SELF_PICKUP_COLLECTED_MESSAGE =
  "ההזמנה סומנה כנאספה באופן עצמאי ממחסני החברה."

const UNKNOWN_STATUS_MESSAGE =
  "ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול."

function coordinatedDeliveryMessage(coordinateDate?: string | null) {
  if (coordinateDate?.trim()) {
    return `המשלוח נמצא אצל חברת השליחויות ומתואם לאספקה בתאריך ${coordinateDate.trim()}.`
  }
  return "המשלוח נמצא אצל חברת השליחויות ומתואם לאספקה."
}

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
  coordinateDate?: string | null
}) {
  const statusId = String(input.deliveryStatusId ?? "").trim()

  if (statusId === "3") return LOADED_MESSAGE
  if (statusId === "4") return AWAITING_DISPATCH_MESSAGE
  if (statusId === "5") return EN_ROUTE_MESSAGE
  if (statusId === "80") return coordinatedDeliveryMessage(input.coordinateDate)
  if (statusId === "22") return PICKUP_READY_MESSAGE
  if (statusId === "21") return PICKUP_PROCESSING_MESSAGE
  if (statusId === "6") return deliveredByCourierMessage(input.deliveryDate)
  if (statusId === "23") return SELF_PICKUP_COLLECTED_MESSAGE
  if (statusId === "1") return PACKED_AWAITING_COURIER_MESSAGE
  if (statusId === "2") return PACKED_AWAITING_COURIER_MESSAGE
  if (/משלוח\s+נוצר|ממתין\s+לאיסוף\s+ש(?:ל|ל)?(?:חברת\s+)?(?:ה)?שליח/i.test(input.deliveryStatusDesc ?? "")) {
    return PACKED_AWAITING_COURIER_MESSAGE
  }

  return UNKNOWN_STATUS_MESSAGE
}
