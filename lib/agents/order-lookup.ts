import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isReturnFlowCorrection, isReturnPolicyQuestion, isPreorderDelayComplaint, mentionsReturnIntent } from "@/lib/agents/inquiry-intent"
import { isDigitalDocumentRequest } from "@/lib/agents/digital-document-flow"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { callPriorityWebhook } from "@/lib/agents/priority-webhook"

const CANCELLATION_EMPATHY_PREFIX =
  "אני מצטער לשמוע, בוא ננסה קודם לאתר את ההזמנה שלך.."

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
  branchCode: string | null
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

function lookupConfigured() {
  return true
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
  documentType?: string
}): Promise<unknown | null> {
  return callPriorityWebhook(input)
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
    row.Y_7455_0_ESH?.trim() ||
    row.LTRN_SELLERNAME?.trim() ||
    row.ZPIT_DISTERIBRANCH?.trim() ||
    "הום"
  )
}

function daysSinceOrder(row: PriorityOrderRow) {
  const iso = row.CURDATE?.trim()
  if (!iso) return null
  const orderDate = new Date(iso)
  if (!Number.isFinite(orderDate.getTime())) return null
  const diffMs = Date.now() - orderDate.getTime()
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
}

function formatDaysAgoPhrase(days: number | null) {
  if (days == null) return null
  if (days === 0) return "היום"
  if (days === 1) return "לפני יום"
  if (days === 2) return "לפני יומיים"
  return `לפני ${days} ימים`
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
    branchCode: row.ZPIT_DISTERIBRANCH?.trim() || null,
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

export type DigitalDocumentLookupResult =
  | { ok: true; link: string }
  | { ok: false; reason: "api_failed" | "not_found" | "invalid_phone" }

export async function lookupDigitalDocument(
  phone: string,
  documentType = "קבלה"
): Promise<DigitalDocumentLookupResult> {
  const value = phoneForOrderApi(phone)
  if (!value) return { ok: false, reason: "invalid_phone" }

  const data = await callOrderWebhook({
    actionType: "getDocument",
    value,
    documentType,
  })
  if (data == null) return { ok: false, reason: "api_failed" }

  const link = parseDocumentLinkFromPayload(data)
  if (link) return { ok: true, link }
  return { ok: false, reason: "not_found" }
}

function parseDocumentLinkFromPayload(data: unknown) {
  if (typeof data === "object" && data != null && "result" in data) {
    const link = String((data as { result: unknown }).result ?? "").trim()
    return link || null
  }
  return null
}

export function extractOrderNumber(text: string) {
  const match = text.match(/\b((?:SO|IN|OV)\d+)\b/i)
  return match?.[1]?.toUpperCase() ?? null
}

/** Order-specific eligibility — not a general policy/options question. */
export function isOrderSpecificEligibilityQuestion(body: string) {
  const text = body.trim()
  if (!text) return false
  if (
    /(?:עבר(?:ו)?|יותר\s+מ|לפני)\s*(?:\d+|י(?:מ)?(?:ים)?|שבוע|חודש)/i.test(text) &&
    mentionsReturnIntent(text)
  ) {
    return true
  }
  if (
    /האם\s+(?:אפשר|עדיין\s+אפשר|עדיין)/i.test(text) &&
    mentionsReturnIntent(text) &&
    /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|הזמנה)/i.test(text)
  ) {
    return true
  }
  return false
}

/**
 * Order lookup is only for shipping status, digital documents, explicit return execution,
 * or a question tied to a specific order (reference, timeframe, eligibility).
 */
export function requiresOrderIdentification(body: string, history: HistoryMessage[] = []) {
  if (isShippingStatusQuestion(body)) return true
  if (isDigitalDocumentRequest(body)) return true
  if (isPreorderDelayComplaint(body)) return true
  if (extractOrderReference(body) || extractOrderNumber(body)) return true
  if (isOrderSpecificEligibilityQuestion(body)) return true
  if (/^(?:החזרה|ביצוע\s+החזרה)(?:[\s,.!?]|$)/i.test(body.trim())) return true

  if (
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history) ||
    isAlternatePhoneRequestPending(history)
  ) {
    return true
  }

  return false
}

/** Reuse order cues from a confirmation prompt — avoids a second Priority lookup on "נכון". */
export function orderSummaryFromConfirmationHistory(
  history: HistoryMessage[],
  orderNumber: string
): OrderShipmentStatus | null {
  const normalizedOrder = orderNumber.toUpperCase()
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (!message.content.includes(normalizedOrder)) continue

    const branchMatch =
      message.content.match(
        /ב(?:וצעה[^?]*?)?(ב(?:סניף|אתר)[^,?]+?)(?:\s+על\s+סך|,|\?)/i
      ) ??
      message.content.match(/\(([^)]+)\)\s*$/i)
    const branchLabel = branchMatch?.[1]?.trim() || "לא ידוע"

    return {
      orderNumber: normalizedOrder,
      branchLabel,
      statusCode: "",
      statusLabel: "",
      statusDescription: "",
      branchCode: null,
      totalPrice: null,
      raw: { ORDNAME: normalizedOrder },
    }
  }
  return null
}

/** Order reference from customer reply — prefixed (SO/IN/OV) or bare digits (not a phone). */
export function extractOrderReference(text: string) {
  const prefixed = extractOrderNumber(text)
  if (prefixed) return prefixed

  const phone = extractPhoneFromText(text)
  for (const match of text.matchAll(/\b(\d{4,})\b/g)) {
    const digits = match[1]
    const start = match.index ?? 0
    const end = start + digits.length
    if (text[start - 1] === "-" || text[end] === "-") continue
    const asPhone = phoneForOrderApi(digits)
    if (/^0\d{9}$/.test(asPhone)) continue
    if (phone && asPhone === phone) continue
    return digits
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

function formatOrderBranchPhrase(branch: string) {
  const label = branch.trim()
  if (/אתר\s+אינטרנט/i.test(label)) return "באתר אינטרנט"
  if (/^סניף\s+/i.test(label)) return `ב${label.replace(/^סניף\s+/i, "")}`
  return `ב${label}`
}

export function isPureOrderConfirmation(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  if (extractPhoneFromText(text)) return false
  if (/^(?:כן(?:\s+כן)?(?:\s+אני)?\s+)?(?:עדיין\s+)?(?:כאן|פה)/iu.test(text)) return false
  return isOrderConfirmationYes(text)
}

export function isPurePhoneLookupConfirmYes(body: string) {
  return isPureOrderConfirmation(body)
}
export function isOrderConfirmationPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      /(?:האם מדובר (?:על )?הזמנה|נדמה לי שמצאתי את ההזמנה)/i.test(message.content) ||
      /\(מס(?:'|׳)?\s*הזמנה\s+(?:SO|IN|OV)\d+\)/i.test(message.content)
    )
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
    if (isInactivityAssistantMessage(message.content)) continue
    return extractOrderNumber(message.content)
  }
  return null
}

export function isOrderConfirmationYes(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  if (/^(?:כן|נכון|בדיוק|זה|זאת|זו|מדובר|אכן|בטח|yes|👍)/i.test(text)) return true
  if (/^(?:זה|זו|זאת)\s+(?:נכון|ה(?:יא|וא)|מדובר)/i.test(text)) return true
  if (/זה\s+המספר\s+שלי|המספר\s+(?:ה)?(?:נכון|שלי)/i.test(text)) return true
  if (/(?:^|[\s,])(?:נראה|כנראה)\s+(?:לי\s+)?שכן(?:[\s,.!?]|$)/i.test(text)) return true
  if (/^(?:כן\s+)?(?:זה\s+)?(?:נראה|כנראה)(?:\s+לי)?(?:[\s,.!?]|$)/i.test(text)) return true
  if (/אמר(?:תי|נו)\s+שכן/i.test(text)) return true
  if (/^(?:כן|yep)[\s,.!?]*$/i.test(text)) return true
  return false
}

export function isOrderConfirmationNo(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  if (isReturnPolicyQuestion(text) || isReturnFlowCorrection(text)) return false
  if (
    /^(?:לא|לא זה|לא נכון|הזמנה אחרת|אחרת|no)(?:[\s,.!?]|$)/i.test(text) ||
    /^לא[\s,]/i.test(text)
  ) {
    return true
  }
  if (/\bלא\b/.test(text) && /(?:זה|זו|זאת|הזמנה)/.test(text)) return true
  return false
}

function formatOrderPrice(price: number | null) {
  if (price == null || !Number.isFinite(price)) return null
  return price.toLocaleString("he-IL", { maximumFractionDigits: 2 })
}

/** Ask customer to confirm a single order (branch, age, total as cues). */
export function buildOrderConfirmationPrompt(order: OrderShipmentStatus) {
  const price = formatOrderPrice(order.totalPrice)
  const branchPhrase = formatOrderBranchPhrase(order.branchLabel)
  const daysPhrase = formatDaysAgoPhrase(daysSinceOrder(order.raw))
  const placedPhrase = daysPhrase ? `, בוצעה ${daysPhrase}` : ""
  const pricePhrase = price ? ` על סך ${price} ש׳׳ח` : ""

  return `${CUSTOMER_HEADER}
אוקיי נדמה לי שמצאתי את ההזמנה${placedPhrase} ${branchPhrase}${pricePhrase} נכון? (מס׳ הזמנה ${order.orderNumber})`
}

export function buildOrderConfirmationClarifyPrompt(order: OrderShipmentStatus) {
  return `${buildOrderConfirmationPrompt(order)}

לא הבנתי — כתבו/י כן אם זו ההזמנה, או לא כדי לבדוק אחרת.`
}

export function buildOrderStatusReply(order: OrderShipmentStatus) {
  return `${CUSTOMER_HEADER}
לגבי הזמנה ${order.orderNumber} (${order.branchLabel}):
${order.statusDescription}

אם צריך עוד משהו — כאן. אפשר גם לכתוב נציג.`
}

export function isBotHelpJustDelivered(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return (
      (/לגבי הזמנה\s+(?:SO|IN|OV)\d+/i.test(message.content) &&
        /(?:אפשר לעזור במשהו נוסף|אם צריך עוד משהו)/i.test(message.content)) ||
      /הנה הקישור למסמך/i.test(message.content)
    )
  }
  return false
}

export function isExplicitHumanRequest(body: string) {
  const text = body.trim()
  if (!text || text.length > 200) return false

  return (
    /(?:^|\s)(?:נציג(?:ה|ת)?|נציג\s+שירות|שיחה\s+עם\s+נציג|אני\s+רוצ(?:ה|ים|ות)\s+נציג|תעביר(?:ו)?\s+(?:לי\s+)?(?:ל)?נציג)/i.test(
      text
    ) || /(?:^|\s)human(?:\s+agent)?(?:\s|$|[?.!,])/i.test(text)
  )
}

export function isHelpInsufficient(body: string) {
  const text = body.trim()
  if (!text || text.length > 200) return false

  return (
    /(?:לא\s+עזר|לא\s+מספיק|עדיין\s+(?:לא|צריך|רוצה)|לא\s+פתר|לא\s+עונה\s+על|זה\s+לא\s+מה\s+ש(?:ביקשתי|רציתי))/i.test(
      text
    ) ||
    /(?:אבל|רק)\s+(?:אני\s+)?(?:רוצ(?:ה|ים|ות)|צריך(?:ים)?)\s+(?:נציג|אנושי|עזרה)/i.test(
      text
    )
  )
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

אם צריך עוד משהו — כאן.`
}

export function buildDigitalDocumentLookupFailureReply() {
  return `${CUSTOMER_HEADER}
לא הצלחנו להוציא את המסמך הדיגיטלי כרגע (ייתכן שהמערכת לא הגיבה בזמן).
האם להעביר לנציג שירות שישלח עבורך?`
}

export function buildDigitalDocumentNotFoundReply() {
  return `${CUSTOMER_HEADER}
לא מצאנו מסמך דיגיטלי לפי הטלפון הזה.
האם להעביר לנציג שירות שיבדוק וישלח עבורך?`
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
    return `(${digits.slice(0, 4)}-${digits.slice(4)})`
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

/** Phone used for order lookup — last user-provided number in the thread, else WhatsApp. */
export function resolveLookupPhoneFromHistory(
  history: HistoryMessage[],
  whatsappPhone?: string
) {
  let lookupPhone = whatsappPhone ? phoneForOrderApi(whatsappPhone) : null

  for (const message of history) {
    if (message.role !== "user") continue
    const phone = extractPhoneFromText(message.content)
    if (phone) lookupPhone = phone
  }

  return lookupPhone || null
}

/** @deprecated Legacy step — new flows skip straight to phone confirm. */
export function isOrderNumberRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return /אוכל לקבל את מספר ההזמנה/i.test(message.content)
  }
  return false
}

/** @deprecated Legacy step — new flows skip straight to phone confirm. */
export function buildOrderNumberRequestPrompt() {
  return `${CUSTOMER_HEADER}
אוכל לקבל את מספר ההזמנה שלך?`
}

export function isPhoneLookupConfirmPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      /האם היא רשומה על המספר/i.test(message.content) ||
      /האם ההזמנה (?:היא )?על טלפון/i.test(message.content) ||
      /האם ההזמנה על המספר/i.test(message.content)
    )
  }
  return false
}

export function mentionsCancellationDesire(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false

  return (
    /(?:לבטל|ביטול|מבטל(?:ים|ות)?|רוצ(?:ה|ים|ות)\s+לבטל|אני\s+רוצ(?:ה|ים|ות)\s+לבטל)/i.test(
      trimmed
    ) || /\b(?:cancel(?:lation)?|want\s+to\s+cancel)\b/i.test(trimmed)
  )
}

function hasCancellationDesireInConversation(
  body: string,
  history: HistoryMessage[] = []
) {
  if (mentionsCancellationDesire(body)) return true
  return history.some(
    (message) =>
      message.role === "user" && mentionsCancellationDesire(message.content)
  )
}

function alreadySentCancellationEmpathy(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      message.content.includes(CANCELLATION_EMPATHY_PREFIX)
  )
}

function shouldApplyCancellationEmpathy(body: string, history: HistoryMessage[]) {
  return (
    hasCancellationDesireInConversation(body, history) &&
    !alreadySentCancellationEmpathy(history)
  )
}

function withCancellationEmpathyPrefix(reply: string) {
  const header = `${CUSTOMER_HEADER}\n`
  if (!reply.startsWith(header)) {
    return `${reply}\n${CANCELLATION_EMPATHY_PREFIX}`
  }

  return `${header}${CANCELLATION_EMPATHY_PREFIX} ${reply.slice(header.length)}`
}

function maybeApplyCancellationEmpathy(
  reply: string,
  body: string,
  history: HistoryMessage[]
) {
  if (!shouldApplyCancellationEmpathy(body, history)) return reply
  return withCancellationEmpathyPrefix(reply)
}

export function buildPhoneLookupConfirmPrompt(whatsappPhone: string) {
  return `${CUSTOMER_HEADER}
קודם אמצא את ההזמנה שלך בזריזות, האם היא רשומה על המספר ממנו אנחנו מתכתבים כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לקבל אותו.`
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
לא הצלחנו לבדוק את ההזמנה כרגע (ייתכן שהמערכת לא הגיבה תוך 15 שניות).
האם להעביר לנציג שירות שיבדוק עבורך?`
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
    if (isInactivityAssistantMessage(message.content)) continue
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

async function lookupAndStartOrderConfirm(
  phone: string,
  empathize?: (reply: string) => string
) {
  const orders = await lookupOrdersByPhone(phone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply()
  const reply = buildOrderConfirmationPrompt(orders[0]!)
  return empathize ? empathize(reply) : reply
}

async function resolveOrderConfirmationFlow(input: {
  body: string
  lookupPhone: string
  history: HistoryMessage[]
}) {
  const pendingOrder = pendingOrderNumberFromHistory(input.history)

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const cached = orderSummaryFromConfirmationHistory(input.history, pendingOrder)
    if (cached) return buildOrderStatusReply(cached)
  }

  const orders = await lookupOrdersByPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply()

  const sorted = orders
  const explicitOrder = extractOrderNumber(input.body)

  if (explicitOrder) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) return buildOrderStatusReply(matched)
  }

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const matched = findOrderByNumber(sorted, pendingOrder)
    if (matched) return buildOrderStatusReply(matched)
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (pendingOrder && isOrderConfirmationNo(input.body)) {
    const currentIndex = sorted.findIndex(
      (order) => order.orderNumber.toUpperCase() === pendingOrder.toUpperCase()
    )
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1
    const nextOrder = sorted[nextIndex]
    if (nextOrder) {
      return buildOrderConfirmationPrompt(nextOrder)
    }
    return buildOrderPickExhaustedReply()
  }

  if (pendingOrder) {
    const current = findOrderByNumber(sorted, pendingOrder)
    if (current) {
      return buildOrderConfirmationClarifyPrompt(current)
    }
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (sorted[0]) return buildOrderConfirmationPrompt(sorted[0]!)
  return buildNoOrdersFoundReply()
}

export async function resolveOrderShippingReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()
  const empathize = (reply: string) =>
    maybeApplyCancellationEmpathy(reply, body, history)

  if (isOrderConfirmationPending(history)) {
    const lookupPhone =
      extractPhoneFromText(body) ||
      resolveLookupPhoneFromHistory(history, whatsappPhone)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveOrderConfirmationFlow({ body, lookupPhone, history })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone, empathize)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/י את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone, empathize)

    if (isPurePhoneLookupConfirmYes(body)) {
      if (!whatsappPhone) return buildPhoneLookupDeclinedReply()
      return lookupAndStartOrderConfirm(whatsappPhone, empathize)
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isPhoneLookupConfirmNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (whatsappPhone) {
      return `${CUSTOMER_HEADER}
לא הבנתי — האם היא רשומה על המספר ממנו אנחנו מתכתבים כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לציון המספר הנכון.`
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (isOrderNumberRequestPending(history)) {
    const orderReference = extractOrderReference(body)
    if (orderReference) {
      return lookupOrderByReference({ orderReference, whatsappPhone, body })
    }

    if (whatsappPhone) {
      return empathize(buildPhoneLookupConfirmPrompt(whatsappPhone))
    }
    return buildPhoneLookupDeclinedReply()
  }

  const orderReference = extractOrderReference(body)
  if (orderReference) {
    return lookupOrderByReference({ orderReference, whatsappPhone, body })
  }

  const providedPhone = extractPhoneFromText(body)
  if (providedPhone && orderLookupEnabled()) {
    return lookupAndStartOrderConfirm(providedPhone, empathize)
  }

  if (whatsappPhone) {
    return empathize(buildPhoneLookupConfirmPrompt(whatsappPhone))
  }
  return buildPhoneLookupDeclinedReply()
}
