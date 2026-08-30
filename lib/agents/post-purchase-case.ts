import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  classifyPostPurchaseCase,
  isPostPurchaseDissatisfaction,
  isPreorderDelayComplaint,
  isProductDefectComplaint,
  isReturnFlowCorrection,
  isReturnPolicyQuestion,
  mentionsReturnIntent,
  type PostPurchaseCaseKind,
} from "@/lib/agents/inquiry-intent"
import {
  buildAlternatePhoneRequestPrompt,
  buildNoOrdersFoundReply,
  buildOrderConfirmationClarifyPrompt,
  buildOrderConfirmationPrompt,
  buildOrderLookupApiFailureReply,
  buildOrderNumberNotFoundReply,
  buildOrderPickExhaustedReply,
  buildPhoneLookupConfirmPrompt,
  buildPhoneLookupDeclinedReply,
  extractOrderNumber,
  extractOrderReference,
  extractPhoneFromText,
  findOrderByNumber,
  isAlternatePhoneRequestPending,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isPhoneLookupConfirmNo,
  isPhoneLookupConfirmPending,
  isPureOrderConfirmation,
  isPurePhoneLookupConfirmYes,
  lookupOrdersByPhone,
  pendingOrderNumberFromHistory,
  requiresOrderIdentification,
  orderSummaryFromConfirmationHistory,
  resolveLookupPhoneFromHistory,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

import {
  caseMarkerForKind,
  DEFECT_FLOW_MARKER,
  flowMarkerFromText,
} from "@/lib/agents/post-purchase-case.constants"
import {
  blocksOrderLookupForSalesConsultation,
} from "@/lib/agents/sales-intake"
import type { AgentId } from "@/lib/agents/types"

export { DEFECT_FLOW_MARKER } from "@/lib/agents/post-purchase-case.constants"

export {
  isProductDefectComplaint,
  isPostPurchaseDissatisfaction,
  isPreorderDelayComplaint,
} from "@/lib/agents/inquiry-intent"

function hasCaseContext(
  body: string,
  history: HistoryMessage[],
  matcher: (text: string) => boolean
) {
  if (matcher(body)) return true
  const recentUserTexts = [
    body,
    ...history
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content),
  ]
  return recentUserTexts.some(matcher)
}

export function activePostPurchaseCaseKind(
  history: HistoryMessage[]
): PostPurchaseCaseKind | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (/השיחה אופסה/i.test(message.content)) return null
    if (isInactivityAssistantMessage(message.content)) continue
    const kind = flowMarkerFromText(message.content)
    if (kind) return kind
  }
  return null
}

export function isProductDefectFlowActive(history: HistoryMessage[]) {
  return activePostPurchaseCaseKind(history) === "defect"
}

export function hasProductDefectContext(body: string, history: HistoryMessage[] = []) {
  return hasCaseContext(body, history, isProductDefectComplaint)
}

export function shouldHandlePostPurchaseCaseFlow(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (blocksOrderLookupForSalesConsultation(body, history, lastAgent)) return false
  if (isReturnPolicyQuestion(body) || isReturnFlowCorrection(body)) return false

  if (activePostPurchaseCaseKind(history)) return true

  const continuingLookup =
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history) ||
    isAlternatePhoneRequestPending(history)

  if (!continuingLookup && !requiresOrderIdentification(body, history)) {
    return false
  }

  if (classifyPostPurchaseCase(body)) return true
  if (
    mentionsReturnIntent(body) &&
    !isReturnPolicyQuestion(body) &&
    requiresOrderIdentification(body, history) &&
    /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|שטיח|פוף|מוצר|הזמנה)/i.test(body)
  ) {
    return true
  }

  if (continuingLookup) {
    return activePostPurchaseCaseKind(history) != null || classifyPostPurchaseCase(body) != null
  }

  return false
}

/** @deprecated Use shouldHandlePostPurchaseCaseFlow */
export function shouldHandleProductDefectFlow(body: string, history: HistoryMessage[]) {
  return shouldHandlePostPurchaseCaseFlow(body, history)
}

function resolveCaseKind(body: string, history: HistoryMessage[]): PostPurchaseCaseKind {
  return (
    activePostPurchaseCaseKind(history) ??
    classifyPostPurchaseCase(body) ??
    (mentionsReturnIntent(body) ? "return_request" : "dissatisfaction")
  )
}

function withCasePrefix(reply: string, kind: PostPurchaseCaseKind) {
  const marker = caseMarkerForKind(kind)
  const header = `${CUSTOMER_HEADER}\n`
  if (!reply.startsWith(header)) return reply
  if (reply.includes(marker)) return reply
  return `${header}${marker}. ${reply.slice(header.length)}`
}

function buildOpeningReply(kind: PostPurchaseCaseKind, whatsappPhone?: string) {
  const phoneQuestion = whatsappPhone?.trim()
    ? buildPhoneLookupConfirmPrompt(whatsappPhone).replace(`${CUSTOMER_HEADER}\n`, "")
    : "מה מספר הטלפון שבוצעה עליו ההזמנה?"

  if (kind === "defect") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)} — זו לא חוויה שאנחנו רוצים שתקבלו.
ניתן לטפל בזה בהחלפה או בהחזר, לפי מדיניות החברה ובהתאם לבדיקת המוצר.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "return_request") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "dissatisfaction") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
נבדוק יחד את האפשרויות — החלפה, החזר או המשך טיפול — לפי מדיניות החברה.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
נבדוק את סטטוס ההזמנה ונעביר לטיפול מתאים.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
}

function buildOrderConfirmedReply(kind: PostPurchaseCaseKind, order: OrderShipmentStatus) {
  if (kind === "defect") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

לגבי הפגם — האפשרויות:
• החלפת המוצר (בסניף או באיסוף/משלוח, לפי התאמה)
• החזרה וזיכוי מלא במקרה של פגם שאושר

נשמח לקבל תמונה של המוצר ושל אזור הפגם, כדי שנוכל להמשיך בטיפול.
האם להעביר את הפנייה לנציג שירות שיטפל בהחלפה/החזרה?`
  }

  if (kind === "return_request") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

נמשיך עם בקשת ההחזר לפי מדיניות החברה.
האם להעביר את הפנייה לנציג שירות שיטפל בזה?`
  }

  if (kind === "dissatisfaction") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

נבדוק יחד את האפשרויות — החלפה, החזר או פתרון אחר — לפי מדיניות החברה והמוצר.
האם להעביר את הפנייה לנציג שירות שיטפל בזה?`
  }

  return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

${order.statusDescription}

האם להעביר את הפנייה לנציג שירות שיבדוק את העיכוב ויחזור אליך?`
}

function mentionsAlternatePhoneIntent(body: string) {
  return /טלפון|מס(?:'|׳|פר)?|אחר|אחות|אח(?:י|ות)?|בעל|אשה|של/i.test(body)
}

async function lookupAndStartOrderConfirm(kind: PostPurchaseCaseKind, phone: string) {
  const orders = await lookupOrdersByPhone(phone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply(phone)
  return withCasePrefix(buildOrderConfirmationPrompt(orders[0]!), kind)
}

async function resolveOrderConfirmationFlow(input: {
  body: string
  lookupPhone: string
  history: HistoryMessage[]
  kind: PostPurchaseCaseKind
}) {
  const pendingOrder = pendingOrderNumberFromHistory(input.history)

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const cached = orderSummaryFromConfirmationHistory(input.history, pendingOrder)
    if (cached) return buildOrderConfirmedReply(input.kind, cached)
  }

  const orders = await lookupOrdersByPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply(input.lookupPhone)

  const sorted = orders
  const explicitOrder = extractOrderNumber(input.body)

  if (explicitOrder) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) return buildOrderConfirmedReply(input.kind, matched)
  }

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const matched = findOrderByNumber(sorted, pendingOrder)
    if (matched) return buildOrderConfirmedReply(input.kind, matched)
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (pendingOrder && isOrderConfirmationNo(input.body)) {
    const currentIndex = sorted.findIndex(
      (order) => order.orderNumber.toUpperCase() === pendingOrder.toUpperCase()
    )
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1
    const nextOrder = sorted[nextIndex]
    if (nextOrder) {
      return withCasePrefix(buildOrderConfirmationPrompt(nextOrder), input.kind)
    }
    return buildOrderPickExhaustedReply()
  }

  if (pendingOrder) {
    const current = findOrderByNumber(sorted, pendingOrder)
    if (current) {
      return withCasePrefix(buildOrderConfirmationClarifyPrompt(current), input.kind)
    }
    return buildOrderNumberNotFoundReply(pendingOrder)
  }

  if (sorted[0]) {
    return withCasePrefix(buildOrderConfirmationPrompt(sorted[0]!), input.kind)
  }
  return buildNoOrdersFoundReply(input.lookupPhone)
}

async function lookupOrderByReference(input: {
  orderReference: string
  whatsappPhone?: string
  body: string
  kind: PostPurchaseCaseKind
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

  if (matched) return buildOrderConfirmedReply(input.kind, matched)
  if (orders.length === 0) return buildNoOrdersFoundReply(lookupPhone)
  return buildOrderNumberNotFoundReply(input.orderReference)
}

export async function resolvePostPurchaseCaseReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()
  const kind = resolveCaseKind(body, history)

  if (isOrderConfirmationPending(history)) {
    const lookupPhone =
      extractPhoneFromText(body) ||
      resolveLookupPhoneFromHistory(history, whatsappPhone)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveOrderConfirmationFlow({ body, lookupPhone, history, kind })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(kind, alternatePhone)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/י את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = extractPhoneFromText(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(kind, alternatePhone)

    if (isPurePhoneLookupConfirmYes(body)) {
      if (!whatsappPhone) return buildPhoneLookupDeclinedReply()
      return lookupAndStartOrderConfirm(kind, whatsappPhone)
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isPhoneLookupConfirmNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (whatsappPhone) {
      const prompt = buildPhoneLookupConfirmPrompt(whatsappPhone).replace(
        `${CUSTOMER_HEADER}\n`,
        `${CUSTOMER_HEADER}\nלא הבנתי — `
      )
      return prompt
    }

    return buildPhoneLookupDeclinedReply()
  }

  const orderReference = extractOrderReference(body)
  if (orderReference) {
    return lookupOrderByReference({ orderReference, whatsappPhone, body, kind })
  }

  const providedPhone = extractPhoneFromText(body)
  if (providedPhone) {
    return lookupAndStartOrderConfirm(kind, providedPhone)
  }

  return buildOpeningReply(kind, whatsappPhone)
}

/** @deprecated Use resolvePostPurchaseCaseReply */
export async function resolveProductDefectComplaintReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  return resolvePostPurchaseCaseReply(input)
}

export function buildProductDefectOpeningReply(whatsappPhone?: string) {
  return buildOpeningReply("defect", whatsappPhone)
}

export function buildProductDefectOptionsReply(order: OrderShipmentStatus) {
  return buildOrderConfirmedReply("defect", order)
}
