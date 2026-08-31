import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import type { PostPurchaseCaseKind } from "@/lib/agents/inquiry-intent"
import { hasServiceUrgencySignal } from "@/lib/agents/inquiry-intent"
import {
  caseMarkerForKind,
  flowMarkerFromText,
} from "@/lib/agents/post-purchase-case.constants"
import {
  isOrderConfirmationNo,
  isPureOrderConfirmation,
} from "@/lib/agents/order-lookup"

export function isPostPurchaseIntentConfirmPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (!/אני\s+צודק\s*\?/i.test(message.content)) return false
    return flowMarkerFromText(message.content) != null
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
    return `אוקיי, אני מבין שהוקמה בקשת איסוף לצורך החזרת מוצר וטרם הגיעו לאסוף ${product === "המוצר" ? "אותו" : "אותו"} ממך`
  }

  if (kind === "return_request") {
    return `אוקיי, אני מבין שקיבלת ${product} ורוצה להחזיר ${product === "המוצר" ? "אותו" : "אותו"}`
  }

  if (kind === "defect") {
    return `אוקיי, אני מבין שקיבלת ${product} ויש בו פגם או בעיה`
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
  const marker = caseMarkerForKind(kind)
  const summary = buildIntentSummary(kind, body)
  const urgency =
    kind === "return_pickup_pending" && hasServiceUrgencySignal(body)
      ? " — ושיש כאן דחיפות."
      : ""

  return `${CUSTOMER_HEADER}
${marker}.
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
