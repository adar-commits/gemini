import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import type { PostPurchaseCaseKind } from "@/lib/agents/inquiry-intent"
import { hasServiceUrgencySignal } from "@/lib/agents/inquiry-intent"
import {
  flowMarkerFromText,
} from "@/lib/agents/post-purchase-case.constants"
import {
  isOrderConfirmationNo,
  isPureOrderConfirmation,
} from "@/lib/agents/order-lookup"

export function postPurchaseKindFromIntentConfirm(text: string): PostPurchaseCaseKind | null {
  if (/בקשת איסוף לצורך החזרת מוצר/.test(text)) return "return_pickup_pending"
  if (/ורוצה להחליף/.test(text)) return "exchange_request"
  if (/ורוצה להחזיר/.test(text)) return "return_request"
  if (/דיווח(?:ת)?\s+על\s+בעיה/.test(text)) return "defect"
  if (/יש בו פגם/.test(text)) return "defect"
  if (/אינך מרוצה/.test(text)) return "dissatisfaction"
  if (/חלק מההזמנה לא הגיע/.test(text)) return "missing_item"
  if (/ההזמנה המוקדמת מתעכבת/.test(text)) return "preorder_delay"
  return null
}

export function activeIntentConfirmKind(history: HistoryMessage[]): PostPurchaseCaseKind | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (/אני\s+צודק\s*\?/i.test(message.content) && /אוקיי,\s+אני\s+מבין/i.test(message.content)) {
      return postPurchaseKindFromIntentConfirm(message.content)
    }
    return null
  }
  return null
}

export function isPostPurchaseIntentConfirmPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (!/אני\s+צודק\s*\?/i.test(message.content)) return false
    if (flowMarkerFromText(message.content)) return true
    return /אוקיי,\s+אני\s+מבין/i.test(message.content)
  }
  return false
}

function productNoun(body: string) {
  if (/שטיח/i.test(body)) return "השטיח"
  if (/פוף/i.test(body)) return "הפוף"
  if (/מוצר/i.test(body)) return "המוצר"
  return "המוצר"
}

function buildIntentSummary(kind: PostPurchaseCaseKind, body: string) {
  const product = productNoun(body)

  if (kind === "return_pickup_pending") {
    return `אוקיי, אני מבין שכבר פתחתם בקשת החזרה, קיבלתם את ${product}, וממתינים ששליח יאסוף ${product === "המוצר" ? "אותו" : "אותו"} מהבית — וטרם הגיעו`
  }

  if (kind === "return_request") {
    return `אוקיי, אני מבין שקיבלת ${product} ורוצה להחזיר ${product === "המוצר" ? "אותו" : "אותו"}`
  }

  if (kind === "exchange_request") {
    return `אוקיי, אני מבין שקיבלת ${product} ורוצה להחליף ${product === "המוצר" ? "אותו" : "אותו"}`
  }

  if (kind === "defect") {
    return `אוקיי, אני מבין שקיבלת ${product} ודיווחת על בעיה או חשש לגבי ${product === "המוצר" ? "אותו" : "אותו"}`
  }

  if (kind === "dissatisfaction") {
    return `אוקיי, אני מבין שקיבלת ${product} ואינך מרוצה ממנו`
  }

  if (kind === "missing_item") {
    return "אוקיי, אני מבין שחלק מההזמנה לא הגיע אליך"
  }

  if (kind === "preorder_delay") {
    return "אוקיי, אני מבין שההזמנה המוקדמת מתעכבת"
  }

  return "אוקיי, אני מבין שיש פנייה שקשורה להזמנה שכבר ביצעת"
}

export function buildPostPurchaseIntentConfirm(kind: PostPurchaseCaseKind, body: string) {
  const summary = buildIntentSummary(kind, body)
  const urgency =
    kind === "return_pickup_pending" && hasServiceUrgencySignal(body)
      ? " — ושיש כאן דחיפות."
      : ""

  return `${CUSTOMER_HEADER}
${summary}${urgency}, אני צודק?`
}

export function buildIntentConfirmDeclinedReply() {
  return `${CUSTOMER_HEADER}
תודה על התיקון — איך אפשר לעזור?`
}

export function isPostPurchaseIntentConfirmed(body: string) {
  return isPureOrderConfirmation(body)
}

export function isPostPurchaseIntentDeclined(body: string) {
  return isOrderConfirmationNo(body)
}
