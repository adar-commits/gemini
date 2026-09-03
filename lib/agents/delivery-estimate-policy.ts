import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  isMappedDeliveryStatusId,
  isUnknownDeliveryStatusMessage,
} from "@/lib/agents/delivery-status-terminology"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

function hasDeliveryStatusData(order: OrderShipmentStatus) {
  return Boolean(order.statusCode?.trim() || order.statusLabel?.trim())
}

const SELF_ASSEMBLY_SLA =
  "לשטיחים ולפופים ל-self assembly: עד 4 ימי עסקים ממועד אישור התשלום (לא כולל שישי, שבת וחגים)."
const READY_POOF_SLA = "לפופים מוכנים: עד 14 ימי עסקים."
const COURIER_COORDINATES =
  "השליח יתאם איתכם טלפונית את מועד האספקה — לא ניתן לקבוע תאריך מדויק מראש."

function formatCoordinateDate(iso: string | null | undefined) {
  if (!iso?.trim()) return null
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return null
  const date = new Date(parsed)
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
}

/** Policy-based delivery estimate — never invent a calendar date except API coordinate date. */
export function buildDeliveryEstimatePolicyReply(order: OrderShipmentStatus) {
  const statusId = String(order.statusCode ?? "").trim()

  if (hasDeliveryStatusData(order) && !isMappedDeliveryStatusId(statusId)) {
    return `${CUSTOMER_HEADER}
לפי הסטטוס במערכת — ${order.statusDescription}
לא ניתן לחשב צפי אספקה מדויק מהנתונים שיש לי.
האם להעביר לנציג שירות שיבדוק ויתעדכן?`
  }

  if (statusId === "6") {
    return `${CUSTOMER_HEADER}
לפי הסטטוס במערכת — המשלוח כבר סומן כנמסר.
אם משהו לא תואם למציאות — האם להעביר לנציג שירות?`
  }

  if (statusId === "23") {
    return `${CUSTOMER_HEADER}
לפי הסטטוס — ההזמנה כבר סומנה כנאספה עצמאית מהמחסן.`
  }

  if (statusId === "22") {
    return `${CUSTOMER_HEADER}
ההזמנה מוכנה לאיסוף עצמי — אפשר להגיע לפי הפרטים שנשלחו קודם.
לשאלות נוספות — האם להעביר לנציג שירות?`
  }

  if (statusId === "21") {
    return `${CUSTOMER_HEADER}
ההזמנה עדיין בטיפול וטרם מוכנה לאיסוף עצמי.
ברגע שתהיה מוכנה — נשלח עדכון.

האם להעביר לנציג שירות לעדכון נוסף?`
  }

  const coordinateDate =
    formatCoordinateDate(order.raw.ZPIT_COORDATE) ??
    (order.promisedDelivery?.trim() || null)

  if (statusId === "80") {
    if (coordinateDate) {
      return `${CUSTOMER_HEADER}
לפי הסטטוס — המשלוח מתואם לאספקה בתאריך ${coordinateDate}.
השליח ייצור קשר לפני ההגעה.

אם צריך שינוי — האם להעביר לנציג שירות?`
    }
    return `${CUSTOMER_HEADER}
לפי הסטטוס — המשלוח מתואם לאספקה אצל חברת השליחויות.
${COURIER_COORDINATES}`
  }

  if (statusId === "5") {
    return `${CUSTOMER_HEADER}
לפי הסטטוס — המשלוח הועמס לשליח ובדרכו אליכם.
${COURIER_COORDINATES}`
  }

  if (statusId === "3" || statusId === "4") {
    return `${CUSTOMER_HEADER}
לפי הסטטוס — המשלוח כבר אצל חברת השליחויות.
${COURIER_COORDINATES}`
  }

  if (statusId === "1" || statusId === "2") {
    return `${CUSTOMER_HEADER}
לפי הסטטוס — ההזמנה נארזה וממתינה לאיסוף על ידי חברת השליחויות.
${COURIER_COORDINATES}`
  }

  // Order status only (pre-shipment) or empty delivery code — general SLA policy
  const statusLine = order.statusDescription?.trim()
  const statusPrefix =
    statusLine && !isUnknownDeliveryStatusMessage(statusLine)
      ? `לפי הסטטוס הנוכחי — ${statusLine}\n\n`
      : ""

  return `${CUSTOMER_HEADER}
${statusPrefix}לפי מדיניות האספקה:
${SELF_ASSEMBLY_SLA}
${READY_POOF_SLA}
${COURIER_COORDINATES}`
}
