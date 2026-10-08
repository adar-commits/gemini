import { endsWithOptionalFollowUpOffer } from "@/lib/agents/conversation-close"
import {
  INACTIVITY_HANDOFF_AUTO_ASSIGN_MS,
  INACTIVITY_PING_MS,
  lastNonInactivityAssistantText,
} from "@/lib/agents/inactivity"
import { isActiveInventoryThread, isSkuRequestPending } from "@/lib/agents/inventory-lookup"
import {
  isOrderConfirmationPending,
  isOrderDisambiguationPending,
  isOrderLookupPhoneReplyPending,
  isOrderNumberRequestPending,
  isServiceOrderIdentificationPending,
} from "@/lib/agents/order-lookup"
import {
  isProductDetailsPending,
  isProductHandoffPending,
} from "@/lib/agents/product-handoff"
import {
  customerRespondedToHandoffWithoutConfirm,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import {
  isActiveSalesConsultation,
  isSalesFinalSummaryPending,
} from "@/lib/agents/sales-intake"
import {
  isDesignerCodeRequestPending,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import { CUSTOMER_HEADER, type AgentId, type HistoryMessage } from "@/lib/agents/types"

/**
 * Sales / inventory threads never auto-close. After a service-style ping (if any),
 * inactivity recovery assigns human_sales instead of closing. שירות keeps ping + close.
 */
export function shouldSkipInactivityClose(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  return (
    isActiveSalesConsultation(history, lastAgent) ||
    isActiveInventoryThread(history)
  )
}

/**
 * מכירות-only: never send "עדיין כאן?". After the quiet window, silently assign
 * human_sales. שירות לקוחות keeps the normal ping + close flow.
 */
export function shouldSkipInactivityPingForSalesHandoff(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (isActiveSalesConsultation(history, lastAgent)) return true
  if (isSalesFinalSummaryPending(history)) return true
  return false
}

function hasPendingCustomerInputThreadState(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  return (
    isHumanHandoffPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    isSalesFinalSummaryPending(history) ||
    isActiveSalesConsultation(history, lastAgent) ||
    isActiveInventoryThread(history) ||
    isSkuRequestPending(history) ||
    isOrderConfirmationPending(history) ||
    isOrderDisambiguationPending(history) ||
    isOrderLookupPhoneReplyPending(history) ||
    isOrderNumberRequestPending(history) ||
    isServiceOrderIdentificationPending(history) ||
    isProductHandoffPending(history) ||
    isProductDetailsPending(history) ||
    isDesignerCodeRequestPending(history)
  )
}

/** Complete FAQ/informational answer — no ping; customer silence is a natural end. */
export function shouldSkipInactivityPingForCompleteReply(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (hasPendingCustomerInputThreadState(history, lastAgent)) return false
  const lastText = lastNonInactivityAssistantText(history)
  if (!lastText) return false
  if (endsWithOptionalFollowUpOffer(lastText)) return true
  const assistantBody = lastText.replace(CUSTOMER_HEADER, "").trim()
  if (!assistantBody || assistantBody.length < 60) return false
  if (/[?؟]/.test(assistantBody)) return false
  return true
}

/**
 * Bot asked a substantive FAQ follow-up — silence must not trigger silent handoff
 * on sales CRM threads (534469923: rug cleaning tips + model question).
 */
export function hasOpenFaqFollowUpQuestion(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (hasPendingCustomerInputThreadState(history, lastAgent)) return false
  if (isHumanHandoffPending(history)) return false
  const lastText = lastNonInactivityAssistantText(history)
  if (!lastText) return false
  if (endsWithOptionalFollowUpOffer(lastText)) return false
  const assistantBody = lastText.replace(CUSTOMER_HEADER, "").trim()
  if (!assistantBody || assistantBody.length < 20) return false
  if (!/[?؟]/.test(assistantBody)) return false
  return true
}

/**
 * Pending human queue — never "עדיין כאן?". After the quiet window, silently assign
 * (sales intake, handoff offer, or service summary awaiting confirm).
 */
export function shouldSilentAutoAssignOnQuietWindow(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (shouldSkipInactivityPingForSalesHandoff(history, lastAgent)) return true
  if (isHumanHandoffPending(history)) {
    if (customerRespondedToHandoffWithoutConfirm(history)) return false
    return true
  }
  if (isServiceHandoffSummaryPending(history)) return true
  return false
}

export function resolveInactivityPingDelayMs(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (shouldSilentAutoAssignOnQuietWindow(history, lastAgent)) {
    return INACTIVITY_HANDOFF_AUTO_ASSIGN_MS
  }
  return INACTIVITY_PING_MS
}
