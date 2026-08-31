import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import {
  classifyPostPurchaseCase,
  hasServiceUrgencySignal,
  isActiveReturnExchangePickupCase,
  isMissingOrPartialDeliveryComplaint,
  isPostPurchaseDissatisfaction,
  isPreorderDelayComplaint,
  isProductDefectComplaint,
  isReturnFlowCorrection,
  isReturnPolicyQuestion,
  mentionsExchangeIntent,
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
  channelPhone,
  extractOrderNumber,
  extractOrderReference,
  extractPhoneFromText,
  findOrderByNumber,
  isAlternatePhoneRequestPending,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isOrderNumberRequestPending,
  isOrderNumberUnknownAnswer,
  isPhoneLookupConfirmNo,
  isPhoneLookupConfirmPending,
  isPureOrderConfirmation,
  isPurePhoneLookupConfirmYes,
  isServiceOrderIdentificationPending,
  isServiceProductIdentificationAnswer,
  lookupOrdersByPhone,
  pendingOrderNumberFromHistory,
  requiresOrderIdentification,
  resolveLookupPhoneFromHistory,
  userProvidedPhone,
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
import { buildReturnPolicyBody, buildExchangePolicyBody } from "@/lib/agents/policy-subjects"
import {
  buildIntentConfirmDeclinedReply,
  buildPostPurchaseIntentConfirm,
  isPostPurchaseIntentConfirmPending,
  isPostPurchaseIntentConfirmed,
  isPostPurchaseIntentDeclined,
  activeIntentConfirmKind,
} from "@/lib/agents/intent-confirmation"
import { isDeliverySchedulingRequest } from "@/lib/agents/shipping"

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
  if (isDeliverySchedulingRequest(body)) return false
  if (isReturnPolicyQuestion(body) || isReturnFlowCorrection(body)) return false
  if (isActiveReturnExchangePickupCase(body)) return true

  if (activePostPurchaseCaseKind(history)) return true

  const continuingLookup =
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history) ||
    isAlternatePhoneRequestPending(history) ||
    isOrderNumberRequestPending(history) ||
    isServiceOrderIdentificationPending(history)

  const establishedCase =
    activePostPurchaseCaseKind(history) != null ||
    activeIntentConfirmKind(history) != null ||
    classifyPostPurchaseCaseFromHistory(history) != null

  if (
    !continuingLookup &&
    !requiresOrderIdentification(body, history) &&
    !isMissingOrPartialDeliveryComplaint(body)
  ) {
    return false
  }

  if (classifyPostPurchaseCase(body)) return true
  if (
    mentionsExchangeIntent(body) &&
    !isReturnPolicyQuestion(body) &&
    requiresOrderIdentification(body, history) &&
    /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|שטיח|פוף|מוצר|הזמנה)/i.test(body)
  ) {
    return true
  }

  if (
    mentionsReturnIntent(body) &&
    !isReturnPolicyQuestion(body) &&
    requiresOrderIdentification(body, history) &&
    /(?:קיבלתי|הגיע(?:ה|ו)?|התקבל|שטיח|פוף|מוצר|הזמנה)/i.test(body)
  ) {
    return true
  }

  if (continuingLookup) {
    if (
      isOrderNumberRequestPending(history) &&
      extractOrderNumber(body) &&
      !establishedCase
    ) {
      return false
    }

    return (
      establishedCase ||
      classifyPostPurchaseCase(body) != null ||
      isMissingOrPartialDeliveryComplaint(body) ||
      isServiceOrderIdentificationPending(history)
    )
  }

  return false
}

/** @deprecated Use shouldHandlePostPurchaseCaseFlow */
export function shouldHandleProductDefectFlow(body: string, history: HistoryMessage[]) {
  return shouldHandlePostPurchaseCaseFlow(body, history)
}

function resolveCaseKind(body: string, history: HistoryMessage[]): PostPurchaseCaseKind | null {
  return (
    activePostPurchaseCaseKind(history) ??
    activeIntentConfirmKind(history) ??
    classifyPostPurchaseCase(body) ??
    classifyPostPurchaseCaseFromHistory(history) ??
    (mentionsReturnIntent(body)
      ? "return_request"
      : mentionsExchangeIntent(body)
        ? "exchange_request"
        : null)
  )
}

function classifyPostPurchaseCaseFromHistory(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "user") continue
    const kind = classifyPostPurchaseCase(message.content)
    if (kind) return kind
  }
  return null
}

function isBareNumericCandidate(body: string) {
  return /^\d{5,10}$/.test(body.trim())
}

function isAmbiguousNumericOrderAttempt(body: string, history: HistoryMessage[]) {
  if (!isBareNumericCandidate(body)) return false
  if (extractOrderNumber(body)) return false
  if (
    isOrderConfirmationPending(history) ||
    isOrderNumberRequestPending(history) ||
    isPhoneLookupConfirmPending(history) ||
    isAlternatePhoneRequestPending(history)
  ) {
    return false
  }

  return (
    activePostPurchaseCaseKind(history) != null ||
    isServiceOrderIdentificationPending(history)
  )
}

function buildAmbiguousOrderNumberClarifyReply(body: string) {
  return `${CUSTOMER_HEADER}
רק לוודא — ${body.trim()} זה מספר ההזמנה?`
}

function withCasePrefix(reply: string, kind: PostPurchaseCaseKind) {
  const marker = caseMarkerForKind(kind)
  const header = `${CUSTOMER_HEADER}\n`
  if (!reply.startsWith(header)) return reply
  if (reply.includes(marker)) return reply
  return `${header}${marker}. ${reply.slice(header.length)}`
}

function buildOpeningReply(
  kind: PostPurchaseCaseKind,
  whatsappPhone?: string,
  body = "",
  afterIntentConfirm = false
) {
  const phoneQuestion = whatsappPhone?.trim()
    ? buildPhoneLookupConfirmPrompt(whatsappPhone).replace(`${CUSTOMER_HEADER}\n`, "")
    : "מה מספר הטלפון שבוצעה עליו ההזמנה?"

  if (kind === "return_pickup_pending") {
    if (afterIntentConfirm) {
      return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
כדי לזרז את הטיפול, נאתר את ההזמנה:
${phoneQuestion}

או כתוב/י "נציג" להעברה מיידית.`
    }
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)} — אני מבין שכבר פתחת בקשה ומחכה לאיסוף, ושזה מתמשך זמן רב מדי.${
      hasServiceUrgencySignal(body) ? "\n\nאני רואה שיש דחיפות — אנסה לטפל בזה בהקדם." : ""
    }

אבדוק מול חברת השליחויות ואעביר לנציג שירות שיחזור אליך.
כדי לזרז, אפשר לאתר את ההזמנה:
${phoneQuestion}

או כתוב/י "נציג" להעברה מיידית.`
  }

  if (afterIntentConfirm) {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "defect") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)} — זו לא חוויה שאני רוצה שתקבלו.
אפשר לטפל בזה בהחלפה או בהחזר, לפי מדיניות החברה ובהתאם לבדיקת המוצר.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "return_request") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "exchange_request") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "dissatisfaction") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
אבדוק יחד איתך את האפשרויות — החלפה, החזר או המשך טיפול — לפי מדיניות החברה.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  if (kind === "missing_item") {
    return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
נבין מה חסר ונטפל בזה.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
  }

  return `${CUSTOMER_HEADER}
${caseMarkerForKind(kind)}.
אבדוק את סטטוס ההזמנה ואעביר לטיפול מתאים.

כדי להתקדם, נאתר קודם את ההזמנה.
${phoneQuestion}`
}

function buildOrderConfirmedReply(
  kind: PostPurchaseCaseKind,
  order: OrderShipmentStatus,
  body = ""
) {
  if (kind === "defect") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

לגבי הפגם — האפשרויות:
• החלפת המוצר (בסניף או באיסוף/משלוח, לפי התאמה)
• החזרה וזיכוי מלא במקרה של פגם שאושר

אשמח לקבל תמונה של המוצר ושל אזור הפגם, כדי שאוכל להמשיך בטיפול.
האם להעביר את הפנייה לנציג שירות שיטפל בהחלפה/החזרה?`
  }

  if (kind === "return_request") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

${buildReturnPolicyBody()}

אם תרצו/י שנציג שירות ילווה בבקשה — כתבו "נציג".

אם צריך עוד משהו — אני כאן.`
  }

  if (kind === "exchange_request") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

${buildExchangePolicyBody()}

אם תרצו/י שנציג שירות ילווה בהחלפה — כתבו "נציג".

אם צריך עוד משהו — אני כאן.`
  }

  if (kind === "return_pickup_pending") {
    const urgency = hasServiceUrgencySignal(body)
      ? " אני רואה שיש דחיפות — אטפל בזה בהקדם."
      : ""
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

אני מבין שכבר פתחת בקשה ומחכה לאיסוף — זה לוקח יותר מדי זמן.${urgency}
אעביר את הפנייה לנציג שירות שיבדוק מול חברת השליחויות ויחזור אליך.

האם להעביר עכשיו לנציג?`
  }

  if (kind === "dissatisfaction") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

אבדוק יחד איתך את האפשרויות — החלפה, החזר או פתרון אחר — לפי מדיניות החברה והמוצר.
האם להעביר את הפנייה לנציג שירות שיטפל בזה?`
  }

  if (kind === "missing_item") {
    return `${CUSTOMER_HEADER}
תודה, איתרנו את הזמנה ${order.orderNumber} (${order.branchLabel}).

${order.statusDescription}

אמשיך לטפל בפריט החסר.
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

  const orders = await lookupOrdersByPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()
  if (orders.length === 0) return buildNoOrdersFoundReply(input.lookupPhone)

  const sorted = orders
  const explicitOrder = extractOrderNumber(input.body)

  if (explicitOrder) {
    const matched = findOrderByNumber(sorted, explicitOrder)
    if (matched) return buildOrderConfirmedReply(input.kind, matched, input.body)
  }

  if (pendingOrder && isPureOrderConfirmation(input.body)) {
    const matched = findOrderByNumber(sorted, pendingOrder)
    if (matched) return buildOrderConfirmedReply(input.kind, matched, input.body)
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
  lookupPhone: string
  body: string
  kind: PostPurchaseCaseKind
}) {
  const orders = await lookupOrdersByPhone(input.lookupPhone)
  if (orders == null) return buildOrderLookupApiFailureReply()

  const prefixed = extractOrderNumber(input.orderReference)
  const matched = prefixed
    ? findOrderByNumber(orders, prefixed)
    : orders.find((order) =>
        order.orderNumber.replace(/\D/g, "").includes(input.orderReference.replace(/\D/g, ""))
      ) ?? null

  if (matched) return buildOrderConfirmedReply(input.kind, matched, input.body)
  if (orders.length === 0) return buildNoOrdersFoundReply(input.lookupPhone)
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
  if (!kind) {
    return `${CUSTOMER_HEADER}
לא הצלחתי לזהות את סוג הפנייה — אפשר לפרט במילים אחרות, או לכתוב "נציג" להעברה לשירות.`
  }

  if (isAmbiguousNumericOrderAttempt(body, history)) {
    return buildAmbiguousOrderNumberClarifyReply(body)
  }

  if (
    isOrderNumberRequestPending(history) ||
    isServiceOrderIdentificationPending(history)
  ) {
    if (isOrderNumberUnknownAnswer(body) || isServiceProductIdentificationAnswer(body, history)) {
      if (whatsappPhone) return buildPhoneLookupConfirmPrompt(whatsappPhone)
      return buildAlternatePhoneRequestPrompt()
    }
  }

  if (isOrderConfirmationPending(history)) {
    const lookupPhone = resolveLookupPhoneFromHistory(history, whatsappPhone, body)
    if (!lookupPhone) return buildPhoneLookupDeclinedReply()
    return resolveOrderConfirmationFlow({ body, lookupPhone, history, kind })
  }

  if (isAlternatePhoneRequestPending(history)) {
    const alternatePhone = userProvidedPhone(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(kind, alternatePhone)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/י את המספר (למשל 050-1234567).`
  }

  if (isPhoneLookupConfirmPending(history)) {
    const alternatePhone = userProvidedPhone(body)
    if (alternatePhone) return lookupAndStartOrderConfirm(kind, alternatePhone)

    if (isPurePhoneLookupConfirmYes(body)) {
      const confirmed = channelPhone(whatsappPhone)
      if (!confirmed) return buildPhoneLookupDeclinedReply()
      return lookupAndStartOrderConfirm(kind, confirmed)
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

  if (isPostPurchaseIntentConfirmPending(history)) {
    if (isPostPurchaseIntentConfirmed(body)) {
      return buildOpeningReply(kind, whatsappPhone, body, true)
    }
    if (isPostPurchaseIntentDeclined(body)) {
      return buildIntentConfirmDeclinedReply()
    }
    const revisedKind = classifyPostPurchaseCase(body) ?? kind
    return buildPostPurchaseIntentConfirm(revisedKind, body)
  }

  const orderReference = extractOrderReference(body, history)
  if (orderReference) {
    const lookupPhone = resolveLookupPhoneFromHistory(history, whatsappPhone, body)
    if (!lookupPhone) return buildOpeningReply(kind, whatsappPhone, body)
    return lookupOrderByReference({ orderReference, lookupPhone, body, kind })
  }

  const providedPhone = userProvidedPhone(body)
  if (providedPhone) {
    return lookupAndStartOrderConfirm(kind, providedPhone)
  }

  if (!activePostPurchaseCaseKind(history)) {
    return buildPostPurchaseIntentConfirm(kind, body)
  }

  return buildOpeningReply(kind, whatsappPhone, body)
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

export function buildReturnRequestConfirmedReply(order: OrderShipmentStatus) {
  return buildOrderConfirmedReply("return_request", order)
}
