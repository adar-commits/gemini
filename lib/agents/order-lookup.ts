import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type OrderShipmentStatus = {
  orderNumber: string
  statusCode: string
  statusLabel: string
  statusDescription?: string
  promisedDelivery?: string | null
  lastUpdated?: string | null
}

export type OrderLookupResponse = {
  orders: OrderShipmentStatus[]
  statusDefinitions?: Record<string, string>
}

function lookupConfigured() {
  return Boolean(process.env.ORDER_LOOKUP_API_URL?.trim())
}

/** Phone → recent orders + shipment status. Returns null when API is not configured or call fails. */
export async function lookupOrdersByPhone(
  phone: string
): Promise<OrderLookupResponse | null> {
  const baseUrl = process.env.ORDER_LOOKUP_API_URL?.trim()
  if (!baseUrl) return null

  const apiKey = process.env.ORDER_LOOKUP_API_KEY?.trim()
  const normalized = phone.replace(/\D/g, "")
  if (!normalized) return null

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ phone: normalized }),
      signal: AbortSignal.timeout(Number(process.env.ORDER_LOOKUP_TIMEOUT_MS ?? "12000")),
    })

    if (!response.ok) return null
    const data = (await response.json()) as OrderLookupResponse
    if (!Array.isArray(data.orders)) return null
    return data
  } catch {
    return null
  }
}

export function formatOrderChoiceLine(order: OrderShipmentStatus) {
  const label = order.statusLabel?.trim() || order.statusCode
  const promised = order.promisedDelivery?.trim()
  return promised
    ? `הזמנה ${order.orderNumber} — ${label} (אספקה מובטחת: ${promised})`
    : `הזמנה ${order.orderNumber} — ${label}`
}

/** When multiple orders match the phone — ask customer to confirm which one. */
export function buildOrderDisambiguationReply(orders: OrderShipmentStatus[]) {
  const lines = orders.slice(0, 5).map((order) => `• ${formatOrderChoiceLine(order)}`)
  return `${CUSTOMER_HEADER}
מצאתי ${orders.length === 1 ? "הזמנה" : "כמה הזמנות"} לפי הטלפון:
${lines.join("\n")}

זו ההזמנה הנכונה? אם כן — כתבו/י את מספר ההזמנה. אם לא — שלח/י מספר הזמנה אחר.`
}

/** Single confirmed order — answer from status payload. */
export function buildOrderStatusReply(order: OrderShipmentStatus) {
  const detail =
    order.statusDescription?.trim() ||
    order.statusLabel?.trim() ||
    "ההזמנה בטיפול — ניצור קשר לתיאום אספקה."
  return `${CUSTOMER_HEADER}
לגבי הזמנה ${order.orderNumber}:
${detail}

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".`
}

export function orderLookupEnabled() {
  return lookupConfigured()
}

/** Fallback when API is not wired yet. */
export function buildShippingStatusFallbackReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק מתי המשלוח/ההזמנה שלך יגיע, אני צריך פרטי הזמנה — מספר הזמנה או טלפון שבו בוצעה הרכישה.
אם יש לך את הפרטים, שלח/י אותם ונמשיך. אם לא — אפשר להעביר לנציג שירות שיבדוק עבורך.`
}
