import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"

const DEFAULT_ORDER_LOOKUP_URL =
  "https://redcarpet.app.n8n.cloud/webhook-test/9a1bc56f-d8c6-472c-a665-833421632caf"

/** Raw row from Priority via n8n getOrders. */
export type PriorityOrderRow = {
  CUSTNAME?: string | null
  CDES?: string | null
  CURDATE?: string | null
  ORDNAME: string
  ORDSTATUSDES?: string | null
  TOTPRICE?: number | null
  LTRN_SELLERNAME?: string | null
  Y_7455_0_ESH?: string | null
  ZPIT_DISTERIBRANCH?: string | null
  ZPIT_DELIVERYCODE?: string | null
  ZPIT_DELIVERYDES?: string | null
  ZPIT_PICKUPPURPOSE?: string | null
  ZPIT_QUANTRETURN?: number | null
  ZPIT_DELSTATUSCODE?: string | null
  ZPIT_DELSTATUSDES?: string | null
  ZPIT_UDATE?: string | null
  ZPIT_PRODDATE?: string | null
  ZPIT_DELDATE?: string | null
  ZPIT_DELIVERED?: string | null
  ZPIT_COORDATE?: string | null
}

export type OrderShipmentStatus = {
  orderNumber: string
  statusCode: string
  statusLabel: string
  statusDescription: string
  promisedDelivery?: string | null
  lastUpdated?: string | null
  customerName?: string | null
  orderStatus?: string | null
  deliveryType?: string | null
  raw: PriorityOrderRow
}

const DELIVERY_STATUS_HINTS: Record<string, string> = {
  "1": "ההזמנה התקבלה וממתינה לטיפול.",
  "2": "ההזמנה בייצור/הכנה.",
  "3": "ההזמנה מוכנה וממתינה למשלוח.",
  "4": "ההזמנה יצאה למשלוח — השליח יתאם טלפונית את מועד האספקה.",
  "5": "ההזמנה בדרך אליך — השליח יתאם טלפונית.",
  "6": "ההזמנה נמסרה.",
  "9": "ההזמנה בוטלה או הוחזרה.",
}

function lookupUrl() {
  return (
    process.env.ORDER_LOOKUP_API_URL?.trim() ||
    process.env.N8N_ORDER_LOOKUP_WEBHOOK_URL?.trim() ||
    DEFAULT_ORDER_LOOKUP_URL
  )
}

function lookupConfigured() {
  return Boolean(lookupUrl())
}

function phoneForOrderApi(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`
  return digits
}

async function callOrderWebhook(input: {
  actionType: string
  value: string
}): Promise<unknown | null> {
  const url = lookupUrl()
  if (!url) return null

  const apiKey = process.env.ORDER_LOOKUP_API_KEY?.trim()

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(Number(process.env.ORDER_LOOKUP_TIMEOUT_MS ?? "15000")),
    })

    if (!response.ok) return null
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

function formatHebrewDate(iso: string | null | undefined) {
  if (!iso?.trim()) return null
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "Asia/Jerusalem",
    })
  } catch {
    return null
  }
}

export function mapPriorityOrderRow(row: PriorityOrderRow): OrderShipmentStatus {
  const orderNumber = row.ORDNAME.trim()
  const statusCode = String(row.ZPIT_DELSTATUSCODE ?? "").trim()
  const statusLabel = String(row.ZPIT_DELSTATUSDES ?? "").trim()
  const delivered = String(row.ZPIT_DELIVERED ?? "").toUpperCase() === "Y"
  const delDate = formatHebrewDate(row.ZPIT_DELDATE)
  const prodDate = formatHebrewDate(row.ZPIT_PRODDATE)
  const deliveryType = row.ZPIT_DELIVERYDES?.trim() || null

  let statusDescription: string

  if (statusCode === "6" || delivered) {
    statusDescription = delDate
      ? `ההזמנה נמסרה ב-${delDate}.`
      : statusLabel
        ? `סטטוס: ${statusLabel}.`
        : "ההזמנה נמסרה."
  } else {
    statusDescription =
      DELIVERY_STATUS_HINTS[statusCode] ||
      (statusLabel ? `סטטוס משלוח: ${statusLabel}.` : "ההזמנה בטיפול.")

    if (prodDate && (statusCode === "2" || statusCode === "3")) {
      statusDescription += ` תאריך הכנה: ${prodDate}.`
    }
    if (delDate) {
      statusDescription += ` מועד אספקה משוער: ${delDate}.`
    }
  }

  if (deliveryType) {
    statusDescription += ` (${deliveryType})`
  }

  return {
    orderNumber,
    statusCode,
    statusLabel,
    statusDescription: statusDescription.trim(),
    promisedDelivery: delDate,
    lastUpdated: row.ZPIT_UDATE ?? null,
    customerName: row.CDES?.trim() || null,
    orderStatus: row.ORDSTATUSDES?.trim() || null,
    deliveryType,
    raw: row,
  }
}

function parseOrdersPayload(data: unknown): PriorityOrderRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is PriorityOrderRow =>
        typeof row === "object" &&
        row != null &&
        typeof (row as PriorityOrderRow).ORDNAME === "string"
    )
  }

  if (
    typeof data === "object" &&
    data != null &&
    Array.isArray((data as { orders?: unknown }).orders)
  ) {
    return parseOrdersPayload((data as { orders: unknown }).orders)
  }

  return []
}

/** Phone → recent orders + shipment status. Returns null when API fails. */
export async function lookupOrdersByPhone(
  phone: string
): Promise<OrderShipmentStatus[] | null> {
  const value = phoneForOrderApi(phone)
  if (!value) return null

  const data = await callOrderWebhook({ actionType: "getOrders", value })
  if (data == null) return null

  const rows = parseOrdersPayload(data)
  return rows.map(mapPriorityOrderRow)
}

/** Digital receipt / invoice link — tries getDocument, then getOrders (some flows return { result }). */
export async function lookupDigitalDocument(
  phone: string
): Promise<string | null> {
  const value = phoneForOrderApi(phone)
  if (!value) return null

  for (const actionType of ["getDocument", "getReceipt"] as const) {
    const data = await callOrderWebhook({ actionType, value })
    if (typeof data === "object" && data != null && "result" in data) {
      const link = String((data as { result: unknown }).result ?? "").trim()
      if (link) return link
    }
  }

  return null
}

export function extractOrderNumber(text: string) {
  const match = text.match(/\b(SO\d{5,})\b/i)
  return match?.[1]?.toUpperCase() ?? null
}

export function findOrderByNumber(
  orders: OrderShipmentStatus[],
  orderNumber: string
) {
  const key = orderNumber.trim().toUpperCase()
  return (
    orders.find((order) => order.orderNumber.toUpperCase() === key) ??
    orders.find((order) => order.orderNumber.toUpperCase().includes(key)) ??
    null
  )
}

export function isOrderDisambiguationPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /זו ההזמנה הנכונה\?|כתבו\/י את מספר ההזמנה|מצאתי כמה הזמנות/i.test(
      message.content
    )
  }
  return false
}

export function formatOrderChoiceLine(order: OrderShipmentStatus) {
  const label = order.statusLabel?.trim() || order.statusCode
  const promised = order.promisedDelivery?.trim()
  const date = order.raw.CURDATE ? formatHebrewDate(order.raw.CURDATE) : null
  const parts = [`${order.orderNumber} — ${label}`]
  if (date) parts.push(`הוזמן ${date}`)
  if (promised) parts.push(`אספקה: ${promised}`)
  return parts.join(" · ")
}

/** When multiple orders match the phone — ask customer to confirm which one. */
export function buildOrderDisambiguationReply(orders: OrderShipmentStatus[]) {
  const lines = orders.slice(0, 5).map((order) => `• ${formatOrderChoiceLine(order)}`)
  return `${CUSTOMER_HEADER}
מצאתי ${orders.length} הזמנות לפי הטלפון:
${lines.join("\n")}

זו ההזמנה הנכונה? אם כן — כתבו/י את מספר ההזמנה (למשל ${orders[0]?.orderNumber ?? "SO…"}).`
}

export function buildOrderStatusReply(order: OrderShipmentStatus) {
  return `${CUSTOMER_HEADER}
לגבי הזמנה ${order.orderNumber}:
${order.statusDescription}

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".`
}

export function buildDigitalDocumentReply(link: string) {
  return `${CUSTOMER_HEADER}
הנה הקישור למסמך הדיגיטלי:
${link}

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".`
}

export function buildNoOrdersFoundReply() {
  return `${CUSTOMER_HEADER}
לא מצאנו הזמנות פעילות לפי הטלפון הזה.
אפשר לשלוח מספר הזמנה (למשל SO26019031), או להעביר לנציג שירות שיבדוק עבורך — האם להעביר?`
}

export function orderLookupEnabled() {
  return lookupConfigured()
}

/** Fallback when API is unavailable. */
export function buildShippingStatusFallbackReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק מתי המשלוח/ההזמנה שלך יגיע, אני צריך פרטי הזמנה — מספר הזמנה או טלפון שבו בוצעה הרכישה.
אם יש לך את הפרטים, שלח/י אותם ונמשיך. אם לא — אפשר להעביר לנציג שירות שיבדוק עבורך.`
}

export async function resolveOrderShippingReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const phone = input.phone?.trim()
  if (!phone || !orderLookupEnabled()) {
    return buildShippingStatusFallbackReply()
  }

  const orders = await lookupOrdersByPhone(phone)
  if (orders == null) {
    return buildShippingStatusFallbackReply()
  }

  if (orders.length === 0) {
    const explicitOrder = extractOrderNumber(input.body)
    if (explicitOrder) {
      return `${CUSTOMER_HEADER}
לא מצאנו הזמנה ${explicitOrder} לפי הטלפון הזה. אפשר לוודא את מספר ההזמנה, או להעביר לנציג שירות.`
    }
    return buildNoOrdersFoundReply()
  }

  const orderNumber = extractOrderNumber(input.body)

  if (orderNumber) {
    const matched = findOrderByNumber(orders, orderNumber)
    if (matched) return buildOrderStatusReply(matched)
    return `${CUSTOMER_HEADER}
לא מצאנו הזמנה ${orderNumber} בין ההזמנות שלך. אפשר לבדוק את המספר או לשלוח מספר אחר.`
  }

  if (orders.length === 1) {
    return buildOrderStatusReply(orders[0]!)
  }

  return buildOrderDisambiguationReply(orders)
}
