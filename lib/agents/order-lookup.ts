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
  branchLabel: string
  totalPrice: number | null
  statusDescription: string
  promisedDelivery?: string | null
  lastStatusUpdate?: string | null
  customerName?: string | null
  orderStatus?: string | null
  deliveryType?: string | null
  raw: PriorityOrderRow
}

/**
 * Shipment status by ZPIT_DELSTATUSCODE — update when operator provides final mapping.
 * Fallback: ZPIT_DELSTATUSDES from ERP when code is missing from map.
 */
export const DELIVERY_STATUS_BY_CODE: Record<string, string> = {
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

function formatHebrewDateTime(iso: string | null | undefined) {
  if (!iso?.trim()) return null
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    })
  } catch {
    return null
  }
}

function orderBranchLabel(row: PriorityOrderRow) {
  return (
    row.LTRN_SELLERNAME?.trim() ||
    row.Y_7455_0_ESH?.trim() ||
    row.ZPIT_DISTERIBRANCH?.trim() ||
    "הום"
  )
}

function orderSortTimestamp(row: PriorityOrderRow) {
  const candidates = [row.CURDATE, row.ZPIT_UDATE, row.ZPIT_PRODDATE]
  for (const iso of candidates) {
    if (!iso?.trim()) continue
    const ms = Date.parse(iso)
    if (Number.isFinite(ms)) return ms
  }
  return 0
}

export function sortOrdersNewestFirst(orders: OrderShipmentStatus[]) {
  return [...orders].sort(
    (a, b) => orderSortTimestamp(b.raw) - orderSortTimestamp(a.raw)
  )
}

/** Status text from ZPIT_DELSTATUSCODE + ZPIT_UDATE (last shipping status change). */
export function describeShipmentStatus(order: OrderShipmentStatus) {
  const code = order.statusCode
  const erpLabel = order.statusLabel?.trim()
  const statusText =
    DELIVERY_STATUS_BY_CODE[code] ||
    (erpLabel ? `סטטוס משלוח: ${erpLabel}.` : `סטטוס משלוח (קוד ${code || "?"}).`)

  const updated = formatHebrewDateTime(order.raw.ZPIT_UDATE)
  const promised = formatHebrewDate(order.raw.ZPIT_DELDATE)

  const lines = [statusText.trim()]
  if (updated) lines.push(`עדכון סטטוס אחרון: ${updated}.`)
  if (promised && code !== "6") lines.push(`מועד אספקה משוער: ${promised}.`)

  return lines.join("\n")
}

export function mapPriorityOrderRow(row: PriorityOrderRow): OrderShipmentStatus {
  const orderNumber = row.ORDNAME.trim()
  const statusCode = String(row.ZPIT_DELSTATUSCODE ?? "").trim()
  const statusLabel = String(row.ZPIT_DELSTATUSDES ?? "").trim()
  const delDate = formatHebrewDate(row.ZPIT_DELDATE)

  const mapped: OrderShipmentStatus = {
    orderNumber,
    statusCode,
    statusLabel,
    branchLabel: orderBranchLabel(row),
    totalPrice: typeof row.TOTPRICE === "number" ? row.TOTPRICE : null,
    statusDescription: "",
    promisedDelivery: delDate,
    lastStatusUpdate: row.ZPIT_UDATE ?? null,
    customerName: row.CDES?.trim() || null,
    orderStatus: row.ORDSTATUSDES?.trim() || null,
    deliveryType: row.ZPIT_DELIVERYDES?.trim() || null,
    raw: row,
  }

  mapped.statusDescription = describeShipmentStatus(mapped)
  return mapped
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

/** Phone → orders sorted newest-first. Returns null when API fails. */
export async function lookupOrdersByPhone(
  phone: string
): Promise<OrderShipmentStatus[] | null> {
  const value = phoneForOrderApi(phone)
  if (!value) return null

  const data = await callOrderWebhook({ actionType: "getOrders", value })
  if (data == null) return null

  const rows = parseOrdersPayload(data)
  return sortOrdersNewestFirst(rows.map(mapPriorityOrderRow))
}

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

export function isOrderConfirmationPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /האם מדובר בהזמנה/i.test(message.content)
  }
  return false
}

/** @deprecated Use isOrderConfirmationPending */
export function isOrderDisambiguationPending(history: HistoryMessage[]) {
  return isOrderConfirmationPending(history)
}

export function pendingOrderNumberFromHistory(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return extractOrderNumber(message.content)
  }
  return null
}

export function isOrderConfirmationYes(body: string) {
  const text = body.trim()
  if (!text || text.length > 40) return false
  return /^(?:כן|נכון|בדיוק|זה|זאת|זו|מדובר|yes|👍)/i.test(text)
}

export function isOrderConfirmationNo(body: string) {
  const text = body.trim()
  if (!text || text.length > 60) return false
  return (
    /^(?:לא|לא זה|לא נכון|הזמנה אחרת|אחרת|no)(?:[\s,.!?]|$)/i.test(text) ||
    /^לא[\s,]/i.test(text)
  )
}

function formatOrderPrice(price: number | null) {
  if (price == null || !Number.isFinite(price)) return null
  return price.toLocaleString("he-IL", { maximumFractionDigits: 2 })
}

/** Ask customer to confirm a single order (branch + total as cues). */
export function buildOrderConfirmationPrompt(
  order: OrderShipmentStatus,
  index: number,
  total: number
) {
  const price = formatOrderPrice(order.totalPrice)
  const pricePhrase = price ? `, סה״כ ${price} ₪` : ""
  const countPhrase =
    total > 1 ? `\n(הזמנה ${index + 1} מתוך ${total} — מהחדשה לישנה)` : ""

  return `${CUSTOMER_HEADER}
האם מדובר בהזמנה ${order.orderNumber} — ${order.branchLabel}${pricePhrase}?${countPhrase}

כתבו/י כן אם נכון, או לא כדי לבדוק הזמנה אחרת.`
}

export function buildOrderStatusReply(order: OrderShipmentStatus) {
  return `${CUSTOMER_HEADER}
לגבי הזמנה ${order.orderNumber} (${order.branchLabel}):
${order.statusDescription}

אפשר לעזור במשהו נוסף? כדי להתחיל מחדש, כתבו "התחלה".`
}

export function buildOrderPickExhaustedReply() {
  return `${CUSTOMER_HEADER}
לא מצאנו התאמה בין ההזמנות שבמערכת לפנייה שלך.
האם להעביר את השיחה לנציג שירות שיבדוק את ההזמנה באופן פרטני?`
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
האם להעביר את השיחה לנציג שירות שיבדוק עבורך?`
}

export function orderLookupEnabled() {
  return lookupConfigured()
}

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

  const history = input.history ?? []
  const sorted = orders

  if (sorted.length === 0) {
    return buildNoOrdersFoundReply()
  }

  const explicitOrder = extractOrderNumber(input.body)
  if (explicitOrder && !isOrderConfirmationPending(history)) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) return buildOrderStatusReply(matched)
  }

  if (isOrderConfirmationPending(history)) {
    const pendingOrder = pendingOrderNumberFromHistory(history)

    if (explicitOrder) {
      const matched = findOrderByNumber(sorted, explicitOrder)
      if (matched) return buildOrderStatusReply(matched)
    }

    if (pendingOrder && isOrderConfirmationYes(input.body)) {
      const matched = findOrderByNumber(sorted, pendingOrder)
      if (matched) return buildOrderStatusReply(matched)
    }

    if (pendingOrder && isOrderConfirmationNo(input.body)) {
      const currentIndex = sorted.findIndex(
        (order) => order.orderNumber.toUpperCase() === pendingOrder.toUpperCase()
      )
      const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1
      const nextOrder = sorted[nextIndex]
      if (nextOrder) {
        return buildOrderConfirmationPrompt(nextOrder, nextIndex, sorted.length)
      }
      return buildOrderPickExhaustedReply()
    }

    if (pendingOrder) {
      const current = findOrderByNumber(sorted, pendingOrder)
      if (current) {
        return `${CUSTOMER_HEADER}
לא הבנתי — האם מדובר בהזמנה ${current.orderNumber} (${current.branchLabel})?
כתבו/י כן או לא.`
      }
    }
  }

  return buildOrderConfirmationPrompt(sorted[0]!, 0, sorted.length)
}
