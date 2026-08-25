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
  ZPIT_DELIVEREDTO?: string | null
  ZPIT_COORDATE?: string | null
  delivery_deliveredto?: string | null
}

export type OrderShipmentStatus = {
  orderNumber: string
  statusCode: string
  statusLabel: string
  branchLabel: string
  totalPrice: number | null
  statusDescription: string
  deliveredTo?: string | null
  promisedDelivery?: string | null
  lastStatusUpdate?: string | null
  customerName?: string | null
  orderStatus?: string | null
  deliveryType?: string | null
  raw: PriorityOrderRow
}

function deliveredToFromRow(row: PriorityOrderRow) {
  for (const value of [row.ZPIT_DELIVEREDTO, row.delivery_deliveredto]) {
    const text = String(value ?? "").trim()
    if (text && text !== "Y" && text !== "N") return text
  }
  return null
}

/** Map ZPIT_DELSTATUSCODE + ZPIT_DELSTATUSDES (+ optional recipient) to customer message. */
export function buildDeliveryStatusMessage(input: {
  deliveryStatusId: string | number
  deliveryStatusDesc: string
  deliveryDeliveredTo?: string | null
}) {
  const statusId = String(input.deliveryStatusId ?? "").trim()
  const statusDesc = input.deliveryStatusDesc.trim() || "לא ידוע"
  const deliveredTo = input.deliveryDeliveredTo?.trim() || null

  let detail = ""
  let includeRecipient = false

  switch (statusId) {
    case "1":
      detail =
        "השטיח נארז במחסני החברה וממתין לאיסוף של חברת השליחויות"
      break
    case "2":
      detail =
        "השטיח נמסר לחברת השליחויות, שליח יצור עמך קשר בזמן הקרוב לתיאום מועד מסירה"
      break
    case "3":
      detail = 'ע"פ רישומנו, השטיח נמסר ללקוח.'
      includeRecipient = Boolean(deliveredTo)
      break
    case "4":
      detail = "השטיח נאסף מהלקוח ובדרכו למחסני החברה"
      break
    case "5":
    case "6":
      detail =
        "השטיח נאסף ע\"י חברת השליחויות, נמצא כעת בתהליך מיון וממתין להפצה בהתאם למסלולי החלוקה."
      break
    case "7":
      detail = "המשלוח בוטל"
      break
    case "8":
      detail =
        "לא ידועים פרטים נוספים על המשלוח, נא לפנות לשירות הלקוחות בטלפון *3076"
      break
    case "9":
    case "12":
      detail =
        "השטיח נאסף ע\"י חברת השליחויות וכרגע בתהליך מיון לקראת הפצתו ללקוח"
      break
    default:
      detail =
        "לא ידועים פרטים נוספים על המשלוח, נא לפנות לשירות הלקוחות בטלפון *3076"
      break
  }

  const lines = [`*סטטוס*: ${statusDesc}`, `*פירוט נוסף*: ${detail}`]
  if (includeRecipient && deliveredTo) {
    lines.push(`שם המקבל: ${deliveredTo}`)
  }

  return lines.join("\n")
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

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown
    }

    const text = (await response.text()).trim()
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
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

/** Status text from ZPIT_DELSTATUSCODE + ZPIT_DELSTATUSDES + ZPIT_UDATE. */
export function describeShipmentStatus(order: OrderShipmentStatus) {
  const message = buildDeliveryStatusMessage({
    deliveryStatusId: order.statusCode,
    deliveryStatusDesc: order.statusLabel || "לא ידוע",
    deliveryDeliveredTo: order.deliveredTo,
  })

  const updated = formatHebrewDateTime(order.raw.ZPIT_UDATE)
  if (!updated) return message

  return `${message}\nעדכון סטטוס אחרון: ${updated}.`
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
    deliveredTo: deliveredToFromRow(row),
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
  const match = text.match(/\b((?:SO|IN|OV)\d+)\b/i)
  return match?.[1]?.toUpperCase() ?? null
}

/** Order reference from customer reply — prefixed (SO/IN/OV) or bare digits (not a phone). */
export function extractOrderReference(text: string) {
  const prefixed = extractOrderNumber(text)
  if (prefixed) return prefixed

  const phone = extractPhoneFromText(text)
  for (const match of text.match(/\b(\d{4,})\b/g) ?? []) {
    const asPhone = phoneForOrderApi(match)
    if (/^0\d{9}$/.test(asPhone)) continue
    if (phone && asPhone === phone) continue
    return match
  }

  return null
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

export function formatDisplayPhone(phone: string) {
  const digits = phoneForOrderApi(phone)
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits || phone.trim()
}

export function extractPhoneFromText(text: string) {
  const patterns = text.match(/(?:\+?972|0)[\d\s-]{8,14}/g) ?? []
  for (const raw of patterns) {
    const digits = phoneForOrderApi(raw)
    if (/^0\d{9}$/.test(digits)) return digits
  }

  const mobile = text.match(/\b0?5\d{8}\b/)
  if (mobile) {
    const digits = phoneForOrderApi(mobile[0])
    if (/^0\d{9}$/.test(digits)) return digits
  }

  return null
}

export function isOrderNumberRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /אוכל לקבל את מספר ההזמנה/i.test(message.content)
  }
  return false
}

export function buildOrderNumberRequestPrompt() {
  return `${CUSTOMER_HEADER}
אוכל לקבל את מספר ההזמנה שלך?`
}

export function isPhoneLookupConfirmPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return (
      /האם ההזמנה (?:היא )?על טלפון/i.test(message.content) ||
      /האם ההזמנה על המספר/i.test(message.content)
    )
  }
  return false
}

export function buildPhoneLookupConfirmPrompt(whatsappPhone: string) {
  return `${CUSTOMER_HEADER}
אני יכול לנסות לאתר את ההזמנה לפי הטלפון שלך, האם ההזמנה היא על טלפון מס׳ ${formatDisplayPhone(whatsappPhone)}?`
}

export function buildPhoneLookupDeclinedReply() {
  return `${CUSTOMER_HEADER}
אוקיי במקרה כזה אצטרך להעביר אותך לנציג שירות אנושי,בסדר?`
}

export function buildShippingNoPhoneReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק את סטטוס ההזמנה נצטרך מספר טלפון שבו בוצעה הרכישה.
אם אין לך — האם להעביר לנציג שירות שיבדוק עבורך?`
}

export function buildOrderLookupApiFailureReply() {
  return `${CUSTOMER_HEADER}
לא הצלחנו לבדוק את ההזמנה כרגע. האם להעביר לנציג שירות שיבדוק עבורך?`
}

export function buildOrderNumberNotFoundReply(orderNumber: string) {
  return `${CUSTOMER_HEADER}
לא מצאנו הזמנה ${orderNumber} על המספר שבדקנו.
האם להעביר לנציג שירות שיבדוק עבורך?`
}

export function isPhoneLookupConfirmYes(body: string) {
  return isOrderConfirmationYes(body)
}

export function isPhoneLookupConfirmNo(body: string) {
  if (!isOrderConfirmationNo(body)) return false
  if (mentionsAlternatePhoneIntent(body)) return false
  return true
}

function mentionsAlternatePhoneIntent(body: string) {
  return /טלפון|מס(?:'|׳|פר)?|אחר|אחות|אח(?:י|ות)?|בעל|אשה|של/i.test(body)
}

export function isAlternatePhoneRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return /מה מספר הטלפון שבוצעה עליו ההזמנה/i.test(message.content)
  }
  return false
}

export function buildAlternatePhoneRequestPrompt() {
  return `${CUSTOMER_HEADER}
מה מספר הטלפון שבוצעה עליו ההזמנה?`
}

async function lookupOrderByReference(input: {
  orderReference: string
  whatsappPhone?: string
  body: string
}) {
  const lookupPhone =
    extractPhoneFromText(input.body) ||
    (input.whatsappPhone ? phoneForOrderApi(input.whatsappPhone) : null)
  if (!lookupPhone) return buildPhoneLookupDeclinedReply()

  const orders = await lookupOrdersByPhone(lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()

  const prefixed = extractOrderNumber(input.orderReference)
  const matched = prefixed
    ? findOrderByNumber(orders, prefixed)
    : orders.find((order) =>
        order.orderNumber.replace(/\D/g, "").includes(input.orderReference.replace(/\D/g, ""))
      ) ?? null

  if (matched) return buildOrderStatusReply(matched)
  if (orders.length === 0) return buildNoOrdersFoundReply()
  return buildOrderNumberNotFoundReply(input.orderReference)
}

async function lookupAndStartOrderConfirm(phone: string) {
  const orders = await lookupOrdersByPhone(phone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply()
  return buildOrderConfirmationPrompt(orders[0]!, 0, orders.length)
}

async function resolveOrderConfirmationFlow(input: {
  body: string
  lookupPhone: string
  history: HistoryMessage[]
}) {
  const orders = await lookupOrdersByPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply()

  const sorted = orders
  const explicitOrder = extractOrderNumber(input.body)

  if (explicitOrder) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) return buildOrderStatusReply(matched)
  }

  const pendingOrder = pendingOrderNumberFromHistory(input.history)

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

  return buildOrderConfirmationPrompt(sorted[0]!, 0, sorted.length)
}

export async function resolveOrderShippingReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()

  if (isOrderConfirmationPending(history)) {
    const lookupPhone =
      extractPhoneFromText(body) ||
      (whatsappPhone ? phoneForOrderApi(whatsappPhone) : null)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveOrderConfirmationFlow({ body, lookupPhone, history })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/י את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone)

    if (isPhoneLookupConfirmYes(body)) {
      if (!whatsappPhone) return buildPhoneLookupDeclinedReply()
      return lookupAndStartOrderConfirm(whatsappPhone)
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isPhoneLookupConfirmNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (whatsappPhone) {
      return `${CUSTOMER_HEADER}
לא הבנתי — האם ההזמנה היא על טלפון מס׳ ${formatDisplayPhone(whatsappPhone)}?`
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (isOrderNumberRequestPending(history)) {
    const orderReference = extractOrderReference(body)
    if (orderReference) {
      return lookupOrderByReference({ orderReference, whatsappPhone, body })
    }

    if (whatsappPhone) return buildPhoneLookupConfirmPrompt(whatsappPhone)
    return buildPhoneLookupDeclinedReply()
  }

  const orderReference = extractOrderReference(body)
  if (orderReference) {
    return lookupOrderByReference({ orderReference, whatsappPhone, body })
  }

  const providedPhone = extractPhoneFromText(body)
  if (providedPhone && orderLookupEnabled()) {
    return lookupAndStartOrderConfirm(providedPhone)
  }

  return buildOrderNumberRequestPrompt()
}
