import { endsWithOptionalFollowUpOffer } from "@/lib/agents/conversation-close"
import {
  INACTIVITY_HANDOFF_AUTO_ASSIGN_MS,
  INACTIVITY_PING_MS,
  isInactivityAssistantMessage,
  lastNonInactivityAssistantText,
} from "@/lib/agents/inactivity"
import { isActiveInventoryThread, isSkuRequestPending } from "@/lib/agents/inventory-lookup"
import {
  isBareOrderNumberDisclosureSettledThread,
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
  isHandoffOfferAbandonedInThread,
  isHumanHandoffOfferPending,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import {
  isActiveSalesConsultation,
  isAwaitingSalesIntakeAnswer,
  isSalesFinalSummaryPending,
  isSalesIntakeQuestionLatest,
} from "@/lib/agents/sales-intake"
import {
  isDesignerCodeRequestPending,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import { CUSTOMER_HEADER, type AgentId, type HistoryMessage } from "@/lib/agents/types"

function isOrderLookupAwaitingCustomerInput(history: HistoryMessage[]) {
  return (
    isOrderNumberRequestPending(history) ||
    isOrderLookupPhoneReplyPending(history) ||
    isOrderDisambiguationPending(history)
  )
}

/**
 * Sales / inventory threads never auto-close. After a service-style ping (if any),
 * inactivity recovery assigns human_sales instead of closing. שירות keeps ping + close.
 */
export function shouldSkipInactivityClose(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (isOrderLookupAwaitingCustomerInput(history)) return false
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
  if (isOrderLookupAwaitingCustomerInput(history)) return false
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
  if (isBareOrderNumberDisclosureSettledThread(history)) return true
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
/** Scripted sales quiz waiting on customer — no 60s silent handoff (534644289). */
export function hasOpenSalesIntakeQuestion(
  history: HistoryMessage[],
  _lastAgent: AgentId | null = null
) {
  return (
    isAwaitingSalesIntakeAnswer(history) && isSalesIntakeQuestionLatest(history)
  )
}

function isProceduralAssistantInterruption(text: string) {
  const body = text.replace(CUSTOMER_HEADER, "").trim()
  if (!body) return true
  if (/קוד האימות/.test(body)) return true
  return body.length < 20
}

/** Last user turn index — used to detect unanswered bot questions. */
function lastUserMessageIndex(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === "user") return index
  }
  return -1
}

export function hasOpenFaqFollowUpQuestion(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (hasPendingCustomerInputThreadState(history, lastAgent)) return false
  if (isHumanHandoffPending(history)) return false

  const lastUserIndex = lastUserMessageIndex(history)

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (isProceduralAssistantInterruption(message.content)) continue

    const text = message.content
    if (endsWithOptionalFollowUpOffer(text)) continue
    const assistantBody = text.replace(CUSTOMER_HEADER, "").trim()
    if (!assistantBody || assistantBody.length < 20) continue
    if (!/[?؟]/.test(assistantBody)) continue
    return index > lastUserIndex
  }

  return false
}

/**
 * Pending human queue — never "עדיין כאן?". After the quiet window, silently assign
 * (sales intake, committed declarative transfer, or service summary awaiting confirm).
 * Open handoff offers need customer confirm — no silent assign (532619558).
 */
export function shouldSilentAutoAssignOnQuietWindow(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (isHandoffOfferAbandonedInThread(history)) return false
  if (hasOpenSalesIntakeQuestion(history, lastAgent)) return false
  if (isOrderLookupAwaitingCustomerInput(history)) return false
  if (shouldSkipInactivityPingForSalesHandoff(history, lastAgent)) return true
  if (isHumanHandoffPending(history)) {
    if (customerRespondedToHandoffWithoutConfirm(history)) return false
    if (isHumanHandoffOfferPending(history)) return false
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
