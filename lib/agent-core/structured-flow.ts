import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityPingPending } from "@/lib/agents/inactivity"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import {
  isAlternatePhoneRequestPending,
  isOrderConfirmationPending,
  isPhoneLookupConfirmPending,
} from "@/lib/agents/order-lookup"
import {
  isProductHandoffPending,
  isProductUrlRequestPending,
} from "@/lib/agents/product-handoff"
import { activePostPurchaseCaseKind } from "@/lib/agents/post-purchase-case"
import { isConfirmationPending } from "@/lib/agents/sales-intake"

/**
 * Deterministic handlers still apply in LLM mode — e.g. כן/לא on order confirm,
 * phone lookup steps, handoff binding, inactivity ack.
 */
export function hasStructuredFlowPending(history: HistoryMessage[]) {
  return (
    isInactivityPingPending(history) ||
    isHumanHandoffPending(history) ||
    isOrderConfirmationPending(history) ||
    isPhoneLookupConfirmPending(history) ||
    isAlternatePhoneRequestPending(history) ||
    isProductUrlRequestPending(history) ||
    isProductHandoffPending(history) ||
    isConfirmationPending(history) ||
    activePostPurchaseCaseKind(history) != null
  )
}
