import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { isInactivityPingPending } from "@/lib/agents/inactivity"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import {
  isAlternatePhoneRequestPending,
  isOrderConfirmationPending,
  isOrderNumberRequestPending,
  isPhoneLookupConfirmPending,
  isServiceOrderIdentificationPending,
} from "@/lib/agents/order-lookup"
import {
  isActiveDigitalDocumentFlow,
  isDocumentChannelQuestionPending,
  isDocumentPhoneLookupPending,
  isLegacyDocumentTypeQuestionPending,
  isDocumentFlowMisunderstandingPending,
} from "@/lib/agents/digital-document-flow"
import {
  isProductHandoffPending,
  isProductUrlRequestPending,
} from "@/lib/agents/product-handoff"
import { activePostPurchaseCaseKind } from "@/lib/agents/post-purchase-case"
import { isConfirmationPending, isActiveSalesConsultation } from "@/lib/agents/sales-intake"

/**
 * Deterministic handlers still apply in LLM mode — e.g. כן/לא on order confirm,
 * phone lookup steps, handoff binding, inactivity ack.
 */
export function hasStructuredFlowPending(history: HistoryMessage[], lastAgent: AgentId | null = null) {
  return (
    isInactivityPingPending(history) ||
    isHumanHandoffPending(history) ||
    isOrderConfirmationPending(history) ||
    isPhoneLookupConfirmPending(history) ||
    isAlternatePhoneRequestPending(history) ||
    isOrderNumberRequestPending(history) ||
    isServiceOrderIdentificationPending(history) ||
    isProductUrlRequestPending(history) ||
    isProductHandoffPending(history) ||
    isConfirmationPending(history) ||
    activePostPurchaseCaseKind(history) != null ||
    isActiveSalesConsultation(history, lastAgent) ||
    isActiveDigitalDocumentFlow(history) ||
    isDocumentChannelQuestionPending(history) ||
    isLegacyDocumentTypeQuestionPending(history) ||
    isDocumentPhoneLookupPending(history) ||
    isDocumentFlowMisunderstandingPending(history)
  )
}
