import { isExplicitExchangeExecutionTurn } from "@/lib/agents/exchange-intake"
import {
  classifyPostPurchaseCase,
  isOrderModificationRequest,
  isRefundTimelineQuestion,
  isReturnEligibilityQuestion,
  isReturnPolicyQuestion,
  isReturnShippingFeeQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  isReturnExchangePolicyFaqQuestion,
  isRugCleaningServiceQuestion,
} from "@/lib/agents/policy-subjects"
import type { HistoryMessage } from "@/lib/agents/types"

/** Customer explicitly asks to speak with a human this turn — not trailing כן on a FAQ pivot. */
export function customerExplicitlyRequestsHuman(body: string) {
  const text = body.trim()
  if (!text) return false
  return /(?:^|\s)(?:נציג|יועץ|בן\s+אדם|אנושי|human)(?:\s|$|[?.!,])|(?:ל)?(?:דבר|דברו)\s+ע(?:ם|ם)\s+(?:נציג|יועץ)|(?:ה)?עביר(?:ו|י)?\s+(?:ל)?(?:נציג|יועץ)|(?:רוצ(?:ה|ים|ות)|(?:מ)?(?:עונ(?:ה|ים|ת)?|בקש(?:ה|ת)?))\s*(?:ל)?(?:נציג|יועץ)/i.test(
    text
  )
}

function isReturnPortalSelfServiceThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" && /returns\.carpetshop\.co\.il/.test(message.content)
  )
}

/**
 * KB answers the bot must give with action: reply — never human_service/sales
 * because reps are offline or a stale handoff offer exists in thread history.
 */
export function isKbSelfServiceFaqThisTurn(
  body: string,
  history: HistoryMessage[] = []
) {
  const text = body.trim()
  if (!text) return false
  if (customerExplicitlyRequestsHuman(text)) return false
  if (isExplicitExchangeExecutionTurn(text, history)) return false
  if (classifyPostPurchaseCase(text) === "exchange_request") return false
  if (isOrderModificationRequest(text)) return false

  if (isReturnShippingFeeQuestion(text)) return true
  if (isReturnEligibilityQuestion(text, history)) return true
  if (isReturnPolicyQuestion(text)) return true
  if (isReturnExchangePolicyFaqQuestion(text)) return true
  if (isRefundTimelineQuestion(text)) return true
  if (isRugCleaningServiceQuestion(text)) return true

  if (
    isReturnPortalSelfServiceThread(history) &&
    /(?:החזר|זיכוי|הובלה|שליח|ביטול|פורטל|מעוניין|שטיח|נתקע)/i.test(text)
  ) {
    return true
  }

  return false
}

/** Downgrade mistaken handoff actions when this turn is a self-service KB FAQ. */
export function coerceKbSelfServiceFaqAction<T extends { action: string; reply?: string }>(
  output: T,
  body: string,
  history: HistoryMessage[] = []
): T {
  if (output.action !== "human_service" && output.action !== "human_sales") {
    return output
  }
  if (!isKbSelfServiceFaqThisTurn(body, history)) return output
  return { ...output, action: "reply" }
}
