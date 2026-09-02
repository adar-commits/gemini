import { buildApiFailureReply } from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER, CUSTOMER_NATURAL_CLOSE } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  isReturnFlowCorrection,
  isReturnPolicyQuestion,
  isPreorderDelayComplaint,
  isMissingOrPartialDeliveryComplaint,
  mentionsReturnIntent,
  isActiveReturnExchangePickupCase,
  isRefundStatusInquiry,
  classifyPostPurchaseCase,
} from "@/lib/agents/inquiry-intent"
import {
  buildReturnPickupAwaitingServiceReply,
  buildServiceHandoffConfirmReply,
  extractServiceIntake,
  isReturnPickupAwaitingThread,
  type ServiceIntake,
} from "@/lib/agents/service-intake"
import { flowMarkerFromText } from "@/lib/agents/post-purchase-case.constants"
import type { AgentId } from "@/lib/agents/types"
import {
  activeOrderLineItemVerificationRequest,
  isDigitalDocumentRequest,
  isOrderLineItemVerificationRequest,
} from "@/lib/agents/digital-document-flow"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  isAwaitingSalesIntakeAnswer,
  isLikelyBudgetIntakeAnswer,
  isSalesIntakeAnswer,
  pendingSalesIntakeQuestionKind,
} from "@/lib/agents/sales-intake"
import { callPriorityWebhook, getPriorityApiLogContext } from "@/lib/agents/priority-webhook"
import {
  recallConversationOrdersLookup,
  recallOrdersLookup,
  rememberConversationOrdersLookup,
  rememberOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import {
  buildDeliveryStatusMessage,
  isUnknownDeliveryStatusMessage,
} from "@/lib/agents/delivery-status-terminology"
import { buildOrderStatusMessage } from "@/lib/agents/order-status-terminology"
import {
  isValidIsraeliMobilePhone,
  normalizePhoneForOrderApi,
} from "@/lib/agents/phone-for-api"

export { buildDeliveryStatusMessage } from "@/lib/agents/delivery-status-terminology"
export { normalizePhoneForOrderApi } from "@/lib/agents/phone-for-api"

const CANCELLATION_EMPATHY_PREFIX =
  "אני מצטער לשמוע, אנסה קודם לאתר את ההזמנה שלכם.."

export const MAX_ORDER_PICK_ATTEMPTS = 3

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

function lookupConfigured() {
  return true
}

function phoneForOrderApi(phone: string) {
  return normalizePhoneForOrderApi(phone)
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

/** Customer-facing status body — date is appended in buildOrderStatusReply. */
export function hasDeliveryStatusData(order: OrderShipmentStatus) {
  return Boolean(order.statusCode?.trim() || order.statusLabel?.trim())
}

export function countOrderConfirmationPrompts(history: HistoryMessage[]) {
  let count = 0
  for (const message of history) {
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (/נדמה לי שמצאתי את ההזמנה/i.test(message.content)) count += 1
  }
  return count
}

export function describeShipmentStatus(order: OrderShipmentStatus) {
  const deliveryDate =
    formatHebrewDate(order.raw.ZPIT_DELDATE) ??
    formatHebrewDate(order.raw.ZPIT_UDATE)
  const coordinateDate = formatHebrewDate(order.raw.ZPIT_COORDATE)

  if (hasDeliveryStatusData(order)) {
    const deliveryMessage = buildDeliveryStatusMessage({
      deliveryStatusId: order.statusCode,
      deliveryStatusDesc: order.statusLabel || "לא ידוע",
      deliveryDate,
      coordinateDate,
    })

    if (!isUnknownDeliveryStatusMessage(deliveryMessage)) {
      return deliveryMessage
    }
  }

  const orderStatusMessage = buildOrderStatusMessage(order.orderStatus)
  if (orderStatusMessage) return orderStatusMessage

  if (hasDeliveryStatusData(order)) {
    return buildDeliveryStatusMessage({
      deliveryStatusId: order.statusCode,
      deliveryStatusDesc: order.statusLabel || "לא ידוע",
      deliveryDate,
      coordinateDate,
    })
  }

  return buildDeliveryStatusMessage({
    deliveryStatusId: "",
    deliveryStatusDesc: "",
    deliveryDate,
    coordinateDate,
  })
}

export function requiresOrderStatusServiceHandoff(order: OrderShipmentStatus) {
  if (!hasDeliveryStatusData(order)) {
    return !buildOrderStatusMessage(order.orderStatus)
  }

  const deliveryMessage = buildDeliveryStatusMessage({
    deliveryStatusId: order.statusCode,
    deliveryStatusDesc: order.statusLabel || "לא ידוע",
    deliveryDate:
      formatHebrewDate(order.raw.ZPIT_DELDATE) ??
      formatHebrewDate(order.raw.ZPIT_UDATE),
    coordinateDate: formatHebrewDate(order.raw.ZPIT_COORDATE),
  })
  if (!isUnknownDeliveryStatusMessage(deliveryMessage)) return false
  return !buildOrderStatusMessage(order.orderStatus)
}

function statusAsOfDate(order: OrderShipmentStatus) {
  return formatHebrewDate(order.raw.ZPIT_UDATE) ?? formatHebrewDateTime(order.raw.ZPIT_UDATE)
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
  if (!isValidIsraeliMobilePhone(phone)) {
    console.warn("[order-lookup] blocked getOrders — phone not from channel/user input", {
      phone,
    })
    return null
  }
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
  if (!isValidIsraeliMobilePhone(phone)) {
    return { ok: false, reason: "invalid_phone" }
  }
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
  const compact = text.match(/\b((?:SO|IN|OV)\s*\d+)\b/i)
  if (compact?.[1]) return compact[1].replace(/\s+/g, "").toUpperCase()
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
  if (isRefundStatusInquiry(body)) return false
  if (isOrderLineItemVerificationRequest(body)) return true
  if (isShippingStatusQuestion(body)) return true
  if (isDigitalDocumentRequest(body)) return true
  if (isPreorderDelayComplaint(body)) return true
  if (isMissingOrPartialDeliveryComplaint(body)) return true
  if (isActiveReturnExchangePickupCase(body)) return true
  if (extractOrderReference(body, history) || extractOrderNumber(body)) return true
  if (isOrderSpecificEligibilityQuestion(body)) return true
  if (/^(?:החזרה|ביצוע\s+החזרה)(?:[\s,.!?]|$)/i.test(body.trim())) return true

  if (
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history) ||
    isAlternatePhoneRequestPending(history) ||
    isOrderNumberRequestPending(history) ||
    isServiceOrderIdentificationPending(history)
  ) {
    return true
  }

  return false
}

const SERVICE_ASSISTANT_CONTEXT_RE =
  /(?:לגבי\s+(?:איסוף\s+להחלפה\/החזרה|פגם|החזרה|החלפה|פריט\s+חסר|הזמנה\s+מוקדמת)|מבין\s+ש(?:השטיח|קיבלת)|נאסף\s+ומחכים|סטטוס\s+ההחזר|הוקמה\s+בקשת\s+איסוף|מצטער\s+על\s+הפגם|נאתר\s+(?:קודם\s+)?א(?:ת\s+)?(?:ה)?הזמנה|מה\s+מספר\s+ההזמנה)/i

const SHIPPING_ASSISTANT_CONTEXT_RE =
  /(?:בדקתי,|סטטוס\s+(?:ה)?משלוח|איפה\s+(?:ה)?(?:משלוח|הזמנה)|מצאתי\s+א(?:ת\s+)?(?:ה)?הזמנה.*(?:נכון|\?))/i

/** Post-purchase / service owns order lookup — shipping must not hijack mid-flow. */
export function isServiceLookupContext(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
): boolean {
  if (lastAgent === "service") return true

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (flowMarkerFromText(message.content)) return true
    if (SERVICE_ASSISTANT_CONTEXT_RE.test(message.content)) return true
    if (SHIPPING_ASSISTANT_CONTEXT_RE.test(message.content)) return false
    break
  }

  const recentUser = history.filter((message) => message.role === "user").slice(-4)
  for (const message of recentUser) {
    if (isRefundStatusInquiry(message.content)) return true
    if (isActiveReturnExchangePickupCase(message.content)) return true
    if (classifyPostPurchaseCase(message.content)) return true
  }

  return false
}

/** Shipping status lookup — only when not in an active service/post-purchase thread. */
export function isShippingLookupContext(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
): boolean {
  if (isServiceLookupContext(history, lastAgent)) return false
  if (isOrderLineItemVerificationRequest(body)) return false
  if (isShippingStatusQuestion(body)) return true

  for (const message of history.filter((entry) => entry.role === "user").slice(-4)) {
    if (isOrderLineItemVerificationRequest(message.content)) return false
    if (isShippingStatusQuestion(message.content)) return true
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (SHIPPING_ASSISTANT_CONTEXT_RE.test(message.content)) return true
    if (SERVICE_ASSISTANT_CONTEXT_RE.test(message.content)) return false
    break
  }

  return lastAgent === "master" || lastAgent === "faq"
}

const ORDER_NUMBER_REQUEST_RE =
  /(?:אוכל לקבל|מה|איז(?:ה|ו))\s+(?:את\s+)?(?:מספר(?:י)?\s+)?(?:ה)?הזמנ(?:ה|ות)|מספר(?:י)?\s+(?:ה)?הזמנ(?:ה|ות)/i

const ORDER_PHONE_ID_REQUEST_RE =
  /מספר\s+(?:ה)?טלפון\s+ש(?:בו|איתו|שאיתו)|הטלפון\s+ש(?:בו|איתו|שאיתו)\s+בוצע|מספר\s+(?:ה)?הזמנה[^?\n]{0,48}מספר\s+(?:ה)?טלפון/i

function isOrderLookupIdentificationAssistantMessage(content: string) {
  return (
    ORDER_NUMBER_REQUEST_RE.test(content) ||
    ORDER_PHONE_ID_REQUEST_RE.test(content)
  )
}

const SERVICE_MISSING_PRODUCT_REQUEST_RE =
  /(?:מה|איז(?:ה|ו))\s+(?:ה)?(?:מוצר|פריט|שטיח).*(?:לא\s+הגיע|חסר|עדיין\s+לא)|(?:מה|איז(?:ה|ו))\s+(?:עוד\s+)?(?:לא\s+)?(?:הגיע|קיבלת)/i

export function isOrderNumberRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return isOrderLookupIdentificationAssistantMessage(message.content)
  }
  return false
}

export function isServiceOrderIdentificationPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      ORDER_NUMBER_REQUEST_RE.test(message.content) ||
      SERVICE_MISSING_PRODUCT_REQUEST_RE.test(message.content)
    )
  }
  return false
}

export function isOrderNumberUnknownAnswer(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  return (
    /^(?:לא\s+)?(?:יודע(?:ת|ים)?|זוכר(?:ת|ים)?|אין\s+(?:לי|ל(?:י|נו))(?:\s+מס(?:'|׳|פר)?|\s+מספר)?|לא\s+זוכר(?:ת|ים)?)(?:[\s,.!?]|$)/i.test(
      text
    ) || /^לא\s+יודע(?:ת|ים)?(?:[\s,.!?]|$)/i.test(text)
  )
}

export function isServiceProductIdentificationAnswer(
  body: string,
  history: HistoryMessage[]
) {
  const text = body.trim()
  if (!text || text.length > 160) return false
  if (isOrderNumberUnknownAnswer(text)) return false
  if (extractOrderNumber(text) || userProvidedPhone(text)) return false

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (SERVICE_MISSING_PRODUCT_REQUEST_RE.test(message.content)) {
      return /(?:שטיח|פוף|מוצר|פריט|סלון|חדר|כרית|תמונ)/i.test(text)
    }
    if (ORDER_NUMBER_REQUEST_RE.test(message.content)) return false
    break
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

/** Order reference from customer reply — prefixed (SO/IN/OV), Shopify #, or bare digits (not a phone). */
export function extractOrderReference(text: string, history: HistoryMessage[] = []) {
  if (isAwaitingSalesIntakeAnswer(history)) {
    const kind = pendingSalesIntakeQuestionKind(history)
    if (kind === "budget" && isLikelyBudgetIntakeAnswer(text)) return null
    if (isSalesIntakeAnswer(text, history)) return null
  }

  const prefixed = extractOrderNumber(text)
  if (prefixed) return prefixed

  const hashMatch = text.match(/#\s*(\d{4,8})\b/)
  if (hashMatch?.[1]) return hashMatch[1]

  const labeled =
    text.match(/(?:ה)?זמנ(?:ה|ות)\s*(?:#|מס(?:'|׳|"|')?\s*)?(\d{4,8})\b/i) ??
    text.match(/(?:מס(?:'|׳|"|')?\s*(?:ה)?הזמנה|order\s*(?:#|no\.?|number)?)\s*(\d{4,8})\b/i)
  if (labeled?.[1]) return labeled[1]

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
  const digits = key.replace(/\D/g, "")

  const exact =
    orders.find((order) => order.orderNumber.toUpperCase() === key) ?? null
  if (exact) return exact

  if (/^(?:SO|IN|OV)\d+$/i.test(key)) {
    return (
      orders.find((order) => order.orderNumber.toUpperCase().includes(key)) ?? null
    )
  }

  if (digits) {
    const shopifyMatch = orders.find((order) => {
      const ordDigits = order.orderNumber.replace(/\D/g, "")
      if (ordDigits === digits || ordDigits.endsWith(digits)) return true
      const reference = String(
        (order.raw as PriorityOrderRow & { REFERENCE?: string }).REFERENCE ?? ""
      ).replace(/\D/g, "")
      return reference === digits || reference.endsWith(digits)
    })
    if (shopifyMatch) return shopifyMatch
  }

  return orders.find((order) => order.orderNumber.toUpperCase().includes(key)) ?? null
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

/** Customer means the WhatsApp/Landbot channel phone — not a typed alternate number. */
export function isChannelPhoneSelfReference(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  if (userProvidedPhone(text)) return false
  if (extractOrderNumber(text)) return false
  return (
    /^(?:ה)?(?:מספר|טלפון)\s+(?:שלי|שלנו)(?:[\s,.!?]|$)/iu.test(text) ||
    /^(?:על|ב)(?:ה)?(?:מספר|טלפון)\s+(?:ה)?(?:זה|נוכחי)(?:[\s,.!?]|$)/iu.test(text) ||
    /^(?:זה|זהו)(?:\s+(?:ה)?(?:מספר(?:\s+(?:ה)?טלפון)?|טלפון))?\s*(?:שלי|שלנו)?(?:[\s,.!?]|$)/iu.test(
      text
    ) ||
    /^(?:כן\s+)?(?:זה|זהו)\s+(?:ה)?(?:מספר(?:\s+(?:ה)?טלפון)?|טלפון)\s+שלי(?:[\s,.!?]|$)/iu.test(
      text
    ) ||
    /^מ(?:מנ)?ו\s+(?:אני\s+)?(?:מתכתב|מדבר)/iu.test(text) ||
    isPurePhoneLookupConfirmYes(text)
  )
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
  if (/^(?:כן|נכון|בדיוק|זה|זאת|זו|מדובר|אכן|בטח|אמת|yes|👍)/i.test(text)) return true
  if (/^(?:אוקיי|אוקי|ok|okay|סבבה)(?:[\s,.!?]|$)/i.test(text)) return true
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

לא הבנתי — כתבו כן אם זו ההזמנה, או לא כדי לבדוק אחרת.`
}

export function buildOrderStatusReply(order: OrderShipmentStatus) {
  const body = order.statusDescription?.trim()
  if (!body) return buildApiFailureReply()
  const asOf = statusAsOfDate(order)
  const datePhrase = asOf ? ` נכון לתאריך ${asOf}` : ""
  return `${CUSTOMER_HEADER}
בדקתי, ${body}${datePhrase}`
}

export function isBotHelpJustDelivered(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    return (
      (/בדקתי,/i.test(message.content) && /נכון לתאריך/i.test(message.content)) ||
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

function lastOrderStatusAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (/בדקתי,/i.test(message.content) && /נכון לתאריך/i.test(message.content)) {
      return message.content
    }
    if (/לגבי הזמנה\s+(?:SO|IN|OV)\d+/i.test(message.content)) {
      return message.content
    }
  }
  return ""
}

/** Follow-up after a status reply — "מה זה אומר?", "לא הבנתי", etc. */
export function isOrderStatusClarificationQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 120) return false

  return (
    /^מה\s+(?:זה|ה(?:סטטוס|משמעות))\s+אומר/i.test(text) ||
    /^מה\s+(?:זה|זאת|הכוונה)/i.test(text) ||
    /^(?:לא\s+)?הבנתי(?:\s+א(?:ת|ת)?)?(?:\s+מה)?(?:\s+(?:זה|הסטטוס))?/i.test(text) ||
    /(?:מה\s+(?:ה)?(?:פירוש|משמעות)|ת(?:וכל|וכלי)\s+לה(?:סביר|סביר))/i.test(text) ||
    /^מה\s+קור(?:ה|ה)\s+(?:ע(?:ם|כש)|כש)/i.test(text)
  )
}

export function buildOrderStatusClarificationReply(history: HistoryMessage[]) {
  const statusText = lastOrderStatusAssistantText(history)

  if (/נארז במחסן|ממתין לאיסוף/i.test(statusText)) {
    return `${CUSTOMER_HEADER}
בקצרה — השטיח כבר נארז במחסן שלנו, וחברת השליחויות עדיין לא אספה אותו.
לאחר האיסוף השליח יתאם איתכם טלפונית את מועד ההגעה.

אם תרצו עדכון מדויק יותר — האם להעביר לנציג שירות?`
  }

  if (/נאסף על ידי חברת השליחויות|ממתין ליציאתו|הועמס לשליח|מתואם לאספקה/i.test(statusText)) {
    return `${CUSTOMER_HEADER}
בקצרה — המשלוח כבר יצא מהמחסן ונמצא בדרך.
השליח יתאם איתכם טלפונית ביום האספקה.

האם להעביר לנציג שירות לעדכון נוסף?`
  }

  if (/נארזה ומוכנה לאיסוף|טרם הועבר|עדיין בטיפול/i.test(statusText)) {
    return `${CUSTOMER_HEADER}
בקצרה — ההזמנה נארזה במחסן וממתינה לאיסוף על ידי חברת השליחויות.
ברגע שתצא לשליח — תקבלו עדכון.

האם להעביר לנציג שירות שיבדוק ויתעדכן?`
  }

  if (/נמסר באמצעות שליח/i.test(statusText)) {
    return `${CUSTOMER_HEADER}
לפי הסטטוס במערכת — המשלוח סומן כנמסר.
אם משהו לא תואם למציאות, אפשר להעביר לנציג שירות שיבדוק.

האם להעביר לנציג שירות?`
  }

  if (/מוכנה לאיסוף/i.test(statusText)) {
    return `${CUSTOMER_HEADER}
ההזמנה מוכנה לאיסוף עצמי מהמחסן — לפי הפרטים שנשלחו קודם.

האם להעביר לנציג שירות לעזרה נוספת?`
  }

  return `${CUSTOMER_HEADER}
בקצרה — הסטטוס מתאר את מצב ההזמנה במערכת לפי העדכון האחרון.
אם משהו לא ברור או צריך בירור — האם להעביר לנציג שירות שיסביר ויתעדכן?`
}

export function buildOrderPickExhaustedReply() {
  return `${CUSTOMER_HEADER}
לא מצאתי התאמה בין ההזמנות שבמערכת לפנייה שלכם.
האם להעביר את השיחה לנציג שירות שיבדוק את ההזמנה באופן פרטני?`
}

export function buildDigitalDocumentReply(link: string) {
  return `${CUSTOMER_HEADER}
הנה הקישור למסמך הדיגיטלי:
${link}

${CUSTOMER_NATURAL_CLOSE}`
}

export function buildOrderVerificationDocumentReply(link: string) {
  return `${CUSTOMER_HEADER}
הנה מסמך ההזמנה (Weezmo) עם פרטי הפריטים — כולל צבע:
${link}

${CUSTOMER_NATURAL_CLOSE}`
}

export function buildDigitalDocumentLookupFailureReply() {
  return buildApiFailureReply()
}

export function buildDigitalDocumentNotFoundReply() {
  return `${CUSTOMER_HEADER}
לא מצאתי מסמך דיגיטלי לפי הטלפון הזה.
האם להעביר לנציג שירות שיבדוק וישלח עבורכם?`
}

export function buildNoOrdersFoundReply(lookupPhone?: string | null) {
  const phoneHint = lookupPhone
    ? ` (${formatDisplayPhone(lookupPhone)})`
    : ""
  return `${CUSTOMER_HEADER}
לא מצאתי הזמנות פעילות לפי הטלפון${phoneHint}.
האם להעביר את השיחה לנציג שירות שיבדוק עבורכם?`
}

export function orderLookupEnabled() {
  return lookupConfigured()
}

export function formatDisplayPhone(phone: string) {
  const digits = phoneForOrderApi(phone)
  if (digits.length === 10 && digits.startsWith("0")) {
    return `(${digits.slice(0, 3)}-${digits.slice(3)})`
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

export function channelPhone(whatsappPhone?: string | null) {
  if (!whatsappPhone?.trim()) return null
  const digits = phoneForOrderApi(whatsappPhone)
  return isValidIsraeliMobilePhone(digits) ? digits : null
}

/** Mobile number explicitly typed by the customer in this message. */
export function userProvidedPhone(body: string) {
  const phone = extractPhoneFromText(body)
  return phone && isValidIsraeliMobilePhone(phone) ? phone : null
}

function isPhoneLookupConfirmAssistantMessage(content: string) {
  return (
    /האם (?:היא )?רשומה על המספר/i.test(content) ||
    /האם ההזמנה (?:היא )?על טלפון/i.test(content) ||
    /האם ההזמנה על המספר/i.test(content)
  )
}

function isAlternatePhoneAssistantMessage(content: string) {
  return /מה מספר הטלפון שבוצעה עליו ההזמנה/i.test(content)
}

/**
 * Phone authorized for Priority lookup: WhatsApp/Landbot after customer confirmed,
 * or a number the customer typed after we asked for alternate phone.
 */
export function authorizedLookupPhoneFromHistory(
  history: HistoryMessage[],
  whatsappPhone?: string
) {
  const channel = channelPhone(whatsappPhone)
  let authorized: string | null = null

  for (let index = 0; index < history.length; index += 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue

    if (isPhoneLookupConfirmAssistantMessage(message.content)) {
      for (let replyIndex = index + 1; replyIndex < history.length; replyIndex += 1) {
        const reply = history[replyIndex]
        if (reply.role === "assistant") break
        if (reply.role !== "user") continue
        if (isPurePhoneLookupConfirmYes(reply.content) && channel) {
          authorized = channel
        }
        const typed = userProvidedPhone(reply.content)
        if (typed) authorized = typed
      }
    }

    if (isAlternatePhoneAssistantMessage(message.content)) {
      for (let replyIndex = index + 1; replyIndex < history.length; replyIndex += 1) {
        const reply = history[replyIndex]
        if (reply.role !== "user") continue
        const typed = userProvidedPhone(reply.content)
        if (typed) authorized = typed
        break
      }
    }
  }

  return authorized
}

/** Phone for order lookup — current message, or previously authorized channel/typed number only. */
export function resolveLookupPhoneFromHistory(
  history: HistoryMessage[],
  whatsappPhone?: string,
  body?: string
) {
  const fromBody = body ? userProvidedPhone(body) : null
  if (fromBody) return fromBody

  // Current-turn confirm — history does not yet include this user message.
  if (
    body?.trim() &&
    (isPurePhoneLookupConfirmYes(body) || isChannelPhoneSelfReference(body)) &&
    isPhoneLookupConfirmPending(history)
  ) {
    const channel = channelPhone(whatsappPhone)
    if (channel) return channel
  }

  if (
    body?.trim() &&
    isChannelPhoneSelfReference(body) &&
    isOrderNumberRequestPending(history)
  ) {
    const channel = channelPhone(whatsappPhone)
    if (channel) return channel
  }

  const authorized = authorizedLookupPhoneFromHistory(history, whatsappPhone)
  if (authorized) return authorized

  // Customer gave an order reference (SO/IN/OV, Shopify #, or bare number) — use channel phone.
  if (body?.trim() && extractOrderReference(body, history)) {
    return channelPhone(whatsappPhone)
  }

  return null
}

/** @deprecated Legacy step — new flows skip straight to phone confirm. */
export function buildOrderNumberRequestPrompt() {
  return `${CUSTOMER_HEADER}
אוכל לקבל את מספר ההזמנה שלכם?`
}

export function isPhoneLookupConfirmPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return (
      /האם היא רשומה על המספר/i.test(message.content) ||
      /האם ההזמנה (?:היא )?על טלפון/i.test(message.content) ||
      /האם ההזמנה על המספר/i.test(message.content) ||
      /האם (?:ה)?טלפון.{0,60}שבוצעה עליו/i.test(message.content) ||
      /מתכתב כרגע/i.test(message.content)
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
קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לקבל אותו.`
}

export function buildPhoneLookupDeclinedReply() {
  return `${CUSTOMER_HEADER}
אוקיי במקרה כזה אצטרך להעביר אתכם לנציג שירות אנושי,בסדר?`
}

export function buildShippingNoPhoneReply() {
  return `${CUSTOMER_HEADER}
כדי לבדוק את סטטוס ההזמנה אצטרך מספר טלפון שבו בוצעה הרכישה.
אם אין לכם — האם להעביר לנציג שירות שיבדוק עבורכם?`
}

export function buildOrderLookupApiFailureReply() {
  return buildApiFailureReply()
}

export function buildOrderNumberNotFoundReply(orderNumber: string) {
  return `${CUSTOMER_HEADER}
לא מצאתי הזמנה ${orderNumber} על המספר שבדקתי.
האם להעביר לנציג שירות שיבדוק עבורכם?`
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

async function deliverOrderVerificationDocumentReply(phone: string) {
  const tried: string[] = []
  for (const documentType of ["קבלה", "חשבונית מס", "חשבונית מס קבלה"]) {
    const result = await lookupDigitalDocument(phone, documentType)
    if (result.ok && !tried.includes(result.link)) {
      return buildOrderVerificationDocumentReply(result.link)
    }
  }
  return buildDigitalDocumentNotFoundReply()
}

async function replyAfterOrderIdentified(
  order: OrderShipmentStatus,
  lookupPhone: string,
  history: HistoryMessage[]
) {
  if (activeOrderLineItemVerificationRequest(history)) {
    return deliverOrderVerificationDocumentReply(lookupPhone)
  }
  if (isServiceLookupContext(history)) {
    const intake = extractServiceIntake(history, "")
    intake.orderNumber = order.orderNumber
    return buildServiceHandoffConfirmReply(intake)
  }
  return buildOrderStatusReply(order)
}

async function lookupOrdersForPhone(phone: string) {
  const conversationId = getPriorityApiLogContext().conversationId
  if (conversationId) {
    const byConversation = recallConversationOrdersLookup(conversationId, phone)
    if (byConversation) return byConversation
  }

  const cached = recallOrdersLookup(phone)
  if (cached) return cached

  const orders = await lookupOrdersByPhone(phone)
  if (orders) {
    rememberOrdersLookup(phone, orders)
    if (conversationId) {
      rememberConversationOrdersLookup(conversationId, phone, orders)
    }
  }
  return orders
}

async function lookupOrderByReference(input: {
  orderReference: string
  lookupPhone: string
  body: string
  history: HistoryMessage[]
}) {
  const orders = await lookupOrdersForPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()

  const prefixed = extractOrderNumber(input.orderReference)
  const matched = prefixed
    ? findOrderByNumber(orders, prefixed)
    : orders.find((order) =>
        order.orderNumber.replace(/\D/g, "").includes(input.orderReference.replace(/\D/g, ""))
      ) ?? null

  if (matched) {
    return replyAfterOrderIdentified(matched, input.lookupPhone, input.history)
  }
  if (orders.length === 0) return buildNoOrdersFoundReply(input.lookupPhone)
  return buildOrderNumberNotFoundReply(input.orderReference)
}

async function lookupAndStartOrderConfirm(
  phone: string,
  empathize?: (reply: string) => string
) {
  const orders = await lookupOrdersForPhone(phone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply(phone)
  const reply = buildOrderConfirmationPrompt(orders[0]!)
  return empathize ? empathize(reply) : reply
}

async function resolveOrderConfirmationFlow(input: {
  body: string
  lookupPhone: string
  history: HistoryMessage[]
}) {
  const pendingOrder = pendingOrderNumberFromHistory(input.history)

  const orders = await lookupOrdersForPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply(input.lookupPhone)

  const sorted = orders
  const explicitOrder = extractOrderNumber(input.body)

  if (explicitOrder) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) {
      return replyAfterOrderIdentified(matched, input.lookupPhone, input.history)
    }
  }

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const matched = findOrderByNumber(sorted, pendingOrder)
    if (matched) {
      return replyAfterOrderIdentified(matched, input.lookupPhone, input.history)
    }
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (pendingOrder && isOrderConfirmationNo(input.body)) {
    const shown = countOrderConfirmationPrompts(input.history)
    if (shown >= MAX_ORDER_PICK_ATTEMPTS) {
      return buildOrderPickExhaustedReply()
    }
    const nextOrder = sorted[shown]
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
  return buildNoOrdersFoundReply(input.lookupPhone)
}

/** Identify order number for return-pickup service report — no shipping status to customer. */
export async function enrichReturnPickupIntake(
  intake: ServiceIntake,
  input: { body: string; phone?: string; history: HistoryMessage[] }
): Promise<ServiceIntake> {
  if (intake.orderNumber) return intake

  const corpus = [
    input.body,
    ...input.history
      .filter((message) => message.role === "user")
      .slice(-6)
      .map((message) => message.content),
  ].join("\n")

  const fromText = extractOrderNumber(input.body) ?? extractOrderNumber(corpus)
  if (fromText) return { ...intake, orderNumber: fromText }

  const lookupPhone = resolveLookupPhoneFromHistory(
    input.history,
    input.phone,
    input.body
  )
  if (!lookupPhone) return intake

  const logContext = getPriorityApiLogContext()
  const conversationId = logContext?.conversationId
  const cached =
    (conversationId
      ? recallConversationOrdersLookup(conversationId, lookupPhone)
      : null) ?? recallOrdersLookup(lookupPhone)

  const orders = cached ?? (await lookupOrdersByPhone(lookupPhone))
  if (!orders?.length) return intake

  if (conversationId) {
    rememberConversationOrdersLookup(conversationId, lookupPhone, orders)
  } else {
    rememberOrdersLookup(lookupPhone, orders)
  }

  return { ...intake, orderNumber: orders[0]!.orderNumber }
}

export async function resolveOrderShippingReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()

  if (isReturnPickupAwaitingThread(history, body)) {
    let intake = extractServiceIntake(history, body)
    intake.issueKind = "return_pickup_pending"
    intake = await enrichReturnPickupIntake(intake, {
      body,
      phone: whatsappPhone,
      history,
    })
    return buildReturnPickupAwaitingServiceReply(intake, body)
  }

  const empathize = (reply: string) =>
    maybeApplyCancellationEmpathy(reply, body, history)

  if (isOrderConfirmationPending(history)) {
    const lookupPhone = resolveLookupPhoneFromHistory(history, whatsappPhone, body)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveOrderConfirmationFlow({ body, lookupPhone, history })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = userProvidedPhone(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone, empathize)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלחו את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = userProvidedPhone(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(alternatePhone, empathize)

    if (isPurePhoneLookupConfirmYes(body) || isChannelPhoneSelfReference(body)) {
      const confirmed = channelPhone(whatsappPhone)
      if (!confirmed) return buildPhoneLookupDeclinedReply()
      return lookupAndStartOrderConfirm(confirmed, empathize)
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isPhoneLookupConfirmNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (whatsappPhone) {
      return `${CUSTOMER_HEADER}
לא הבנתי — האם היא רשומה על המספר ממנו אני מתכתב כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לציון המספר הנכון.`
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (isOrderNumberRequestPending(history)) {
    if (isOrderNumberUnknownAnswer(body)) {
      if (whatsappPhone) return empathize(buildPhoneLookupConfirmPrompt(whatsappPhone))
      return buildAlternatePhoneRequestPrompt()
    }

    if (isChannelPhoneSelfReference(body)) {
      const confirmed = channelPhone(whatsappPhone)
      if (confirmed) return lookupAndStartOrderConfirm(confirmed, empathize)
    }

    const orderReference = extractOrderReference(body, history)
    if (orderReference) {
      const lookupPhone =
        resolveLookupPhoneFromHistory(history, whatsappPhone, body) ??
        channelPhone(whatsappPhone)
      if (!lookupPhone) {
        return buildShippingNoPhoneReply()
      }
      return lookupOrderByReference({ orderReference, lookupPhone, body, history })
    }

    if (whatsappPhone) {
      return empathize(buildPhoneLookupConfirmPrompt(whatsappPhone))
    }
    return buildPhoneLookupDeclinedReply()
  }

  const orderReference = extractOrderReference(body, history)
  if (orderReference) {
    const lookupPhone =
      resolveLookupPhoneFromHistory(history, whatsappPhone, body) ??
      channelPhone(whatsappPhone)
    if (!lookupPhone) {
      return buildShippingNoPhoneReply()
    }
    return lookupOrderByReference({ orderReference, lookupPhone, body, history })
  }

  const providedPhone = userProvidedPhone(body)
  if (providedPhone && orderLookupEnabled()) {
    return lookupAndStartOrderConfirm(providedPhone, empathize)
  }

  if (whatsappPhone) {
    return empathize(buildPhoneLookupConfirmPrompt(whatsappPhone))
  }
  return buildPhoneLookupDeclinedReply()
}
