import { isDigitalDocumentRequest } from "@/lib/agents/digital-document-flow"
import { isPreorderDelayComplaint } from "@/lib/agents/inquiry-intent"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { looksLikeMultipleQuestions } from "@/lib/agents/multi-question"
import { isSalesConsultationTrigger, isConfirmationPending } from "@/lib/agents/sales-intake"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { isProductAvailabilityQuestion } from "@/lib/agents/product-handoff"
import type { HistoryMessage, MasterAction } from "@/lib/agents/types"

export type ConfidentRouteKind = "sales" | "document" | "shipping_status"

export type ConfidentRoute = {
  kind: ConfidentRouteKind
  action: MasterAction
}

function hasAmbiguitySignals(body: string, history: HistoryMessage[]) {
  if (looksLikeMultipleQuestions(body)) return true
  if (isHumanHandoffPending(history)) return true
  if (isConfirmationPending(history)) return true
  if (/ממציא|שקר|לא\s+נכון|זה\s+לא\s+מה\s+ש|אמרת\s+קודם|לא\s+מקבל/i.test(body)) return true
  return false
}

/** High-confidence routes that may skip the master router LLM (T1). */
export function confidentSkipMasterRoute(
  body: string,
  history: HistoryMessage[]
): ConfidentRoute | null {
  const text = body.trim()
  if (!text || hasAmbiguitySignals(text, history)) return null

  if (isDigitalDocumentRequest(text)) {
    return { kind: "document", action: "ROUTE_TO_SHIPPING_STATUS" }
  }

  if (
    isShippingStatusQuestion(text) &&
    !isPreorderDelayComplaint(text) &&
    !isDigitalDocumentRequest(text)
  ) {
    return { kind: "shipping_status", action: "ROUTE_TO_SHIPPING_STATUS" }
  }

  if (
    (isSalesConsultationTrigger(text) || /רוצה\s+לקנות|מחפש(?:ים|ת|ים)?(?:\s+ל(?:קנות|רכוש))?/i.test(text)) &&
    !isProductAvailabilityQuestion(text) &&
    !/כמה\s+עולה|מחיר\s+של|במלאי|sku/i.test(text)
  ) {
    return { kind: "sales", action: "ROUTE_TO_SALES_AGENT" }
  }

  return null
}
