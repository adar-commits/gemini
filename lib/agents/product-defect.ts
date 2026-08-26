import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  buildAlternatePhoneRequestPrompt,
  buildNoOrdersFoundReply,
  buildOrderConfirmationClarifyPrompt,
  buildOrderConfirmationPrompt,
  buildOrderLookupApiFailureReply,
  buildOrderNumberNotFoundReply,
  buildOrderPickExhaustedReply,
  buildPhoneLookupDeclinedReply,
  extractOrderNumber,
  extractOrderReference,
  extractPhoneFromText,
  findOrderByNumber,
  formatDisplayPhone,
  isAlternatePhoneRequestPending,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  isPhoneLookupConfirmNo,
  isPhoneLookupConfirmPending,
  isPhoneLookupConfirmYes,
  lookupOrdersByPhone,
  pendingOrderNumberFromHistory,
  resolveLookupPhoneFromHistory,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

export const DEFECT_FLOW_MARKER = "מצטערים על הפגם במוצר"

const DEFECT_RE =
  /פגם|פגום|פגומ(?:ה|ים|ות)|קרוע|שבור|סדוק|מקולקל|נזק|ליקוי/i

const RECEIVED_PRODUCT_RE =
  /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|קיבלנו)/i

const PRODUCT_NOUN_RE =
  /(?:שטיח|פוף|מוצר|הזמנה|תמונ(?:ה|ת)|כרית|שטיחון)/i

/** Customer reports a defect or damage on a product they received. */
export function isProductDefectComplaint(body: string) {
  const text = body.trim()
  if (!text) return false

  if (DEFECT_RE.test(text)) {
    if (RECEIVED_PRODUCT_RE.test(text) || PRODUCT_NOUN_RE.test(text)) return true
    if (/(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי)/i.test(text)) return true
  }

  if (
    RECEIVED_PRODUCT_RE.test(text) &&
    /(?:יש|קיים)\s+(?:ב(?:ו|ה|הם)?\s+)?(?:פגם|ליקוי|בעיה)/i.test(text)
  ) {
    return true
  }

  return false
}

export function hasProductDefectContext(body: string, history: HistoryMessage[] = []) {
  if (isProductDefectComplaint(body)) return true

  const recentUserTexts = [
    body,
    ...history
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content),
  ]

  return recentUserTexts.some((text) => isProductDefectComplaint(text))
}

export function isProductDefectFlowActive(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (/השיחה אופסה/i.test(message.content)) return false
    if (isInactivityAssistantMessage(message.content)) continue
    if (message.content.includes(DEFECT_FLOW_MARKER)) return true
    return false
  }
  return false
}

export function shouldHandleProductDefectFlow(body: string, history: HistoryMessage[]) {
  if (isProductDefectFlowActive(history)) return true
  if (hasProductDefectContext(body, history)) return true
  return false
}

function withDefectFlowPrefix(reply: string) {
  const header = `${CUSTOMER_HEADER}\n`
  if (!reply.startsWith(header)) return reply
  if (reply.includes(DEFECT_FLOW_MARKER)) return reply
  return `${header}${DEFECT_FLOW_MARKER}. ${reply.slice(header.length)}`
}

export function buildProductDefectOpeningReply(whatsappPhone?: string) {
  const intro = `${CUSTOMER_HEADER}
${DEFECT_FLOW_MARKER} — זו לא חוויה שאנחנו רוצים שתקבלו.
ניתן לטפל בזה בהחלפה או בהחזר, לפי מדיניות החברה ובהתאם לבדיקת המוצר.

כדי להתקדם, נאתר קודם את ההזמנה.`

  if (whatsappPhone?.trim()) {
    return `${intro}
האם ההזמנה היא על טלפון מס׳ ${formatDisplayPhone(whatsappPhone)}?`
  }

  return `${intro}
מה מספר הטלפון שבוצעה עליו ההזמנה?`
}

export function buildProductDefectOptionsReply(order: OrderShipmentStatus) {
  return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

לגבי הפגם — האפשרויות:
• החלפת המוצר (בסניף או באיסוף/משלוח, לפי התאמה)
• החזרה וזיכוי מלא במקרה של פגם שאושר

נשמח לקבל תמונה של המוצר ושל אזור הפגם, כדי שנוכל להמשיך בטיפול.
האם להעביר את הפנייה לנציג שירות שיטפל בהחלפה/החזרה?`
}

function mentionsAlternatePhoneIntent(body: string) {
  return /טלפון|מס(?:'|׳|פר)?|אחר|אחות|אח(?:י|ות)?|בעל|אשה|של/i.test(body)
}

async function lookupAndStartDefectOrderConfirm(phone: string) {
  const orders = await lookupOrdersByPhone(phone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply()
  return withDefectFlowPrefix(buildOrderConfirmationPrompt(orders[0]!))
}

async function resolveDefectOrderConfirmationFlow(input: {
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
    if (matched) return buildProductDefectOptionsReply(matched)
  }

  const pendingOrder = pendingOrderNumberFromHistory(input.history)

  if (pendingOrder && isOrderConfirmationYes(input.body)) {
    const matched = findOrderByNumber(sorted, pendingOrder)
    if (matched) return buildProductDefectOptionsReply(matched)
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (pendingOrder && isOrderConfirmationNo(input.body)) {
    const currentIndex = sorted.findIndex(
      (order) => order.orderNumber.toUpperCase() === pendingOrder.toUpperCase()
    )
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1
    const nextOrder = sorted[nextIndex]
    if (nextOrder) {
      return withDefectFlowPrefix(buildOrderConfirmationPrompt(nextOrder))
    }
    return buildOrderPickExhaustedReply()
  }

  if (pendingOrder) {
    const current = findOrderByNumber(sorted, pendingOrder)
    if (current) {
      return withDefectFlowPrefix(buildOrderConfirmationClarifyPrompt(current))
    }
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (sorted[0]) {
    return withDefectFlowPrefix(buildOrderConfirmationPrompt(sorted[0]!))
  }
  return buildNoOrdersFoundReply()
}

async function lookupDefectOrderByReference(input: {
  orderReference: string
  whatsappPhone?: string
  body: string
}) {
  const lookupPhone =
    extractPhoneFromText(input.body) ||
    resolveLookupPhoneFromHistory([], input.whatsappPhone)
  if (!lookupPhone) return buildPhoneLookupDeclinedReply()

  const orders = await lookupOrdersByPhone(lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()

  const prefixed = extractOrderNumber(input.orderReference)
  const matched = prefixed
    ? findOrderByNumber(orders, prefixed)
    : orders.find((order) =>
        order.orderNumber.replace(/\D/g, "").includes(input.orderReference.replace(/\D/g, ""))
      ) ?? null

  if (matched) return buildProductDefectOptionsReply(matched)
  if (orders.length === 0) return buildNoOrdersFoundReply()
  return buildOrderNumberNotFoundReply(input.orderReference)
}

export async function resolveProductDefectComplaintReply(input: {
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
      resolveLookupPhoneFromHistory(history, whatsappPhone)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveDefectOrderConfirmationFlow({ body, lookupPhone, history })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartDefectOrderConfirm(alternatePhone)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/י את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartDefectOrderConfirm(alternatePhone)

    if (isPhoneLookupConfirmYes(body)) {
      if (!whatsappPhone) return buildPhoneLookupDeclinedReply()
      return lookupAndStartDefectOrderConfirm(whatsappPhone)
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

  const orderReference = extractOrderReference(body)
  if (orderReference) {
    return lookupDefectOrderByReference({ orderReference, whatsappPhone, body })
  }

  const providedPhone = extractPhoneFromText(body)
  if (providedPhone) {
    return lookupAndStartDefectOrderConfirm(providedPhone)
  }

  return buildProductDefectOpeningReply(whatsappPhone)
}
