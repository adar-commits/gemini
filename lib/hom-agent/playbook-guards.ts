import { isActiveDigitalDocumentFlow } from "@/lib/agents/digital-document-flow"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import {
  hasOngoingSalesIntake,
  isAwaitingSalesIntakeAnswer,
} from "@/lib/agents/sales-intake"
import {
  isHumanHandoffPending,
  isHumanHandoffOfferPending,
} from "@/lib/agents/off-topic"
import {
  isOrderLookupCompletedInThread,
  isOrderConfirmationPending,
  isServiceOrderIdentificationFlow,
} from "@/lib/agents/order-lookup"
import {
  isServiceHandoffSummaryPending,
  isReturnPickupAwaitingThread,
  isPostPurchaseServiceFlow,
} from "@/lib/agents/service-intake"
import { isExchangeIntakeActive } from "@/lib/agents/exchange-intake"
import type { HistoryMessage } from "@/lib/agents/types"

export type PlaybookGuardInput = {
  history: HistoryMessage[]
  body: string
  /** LLM owns intent this turn (opening-turn-llm gate) — keep full routing playbook. */
  llmOwnsIntent?: boolean
}

/** Load department-boundaries playbook (~15KB) when routing depth is needed. */
export function shouldIncludeDepartmentPlaybook(input: PlaybookGuardInput) {
  const { history, body, llmOwnsIntent } = input

  // Critical: omitting this on LLM-first turns caused misroutes after token opt.
  if (llmOwnsIntent) return true

  if (isHumanHandoffPending(history) || isHumanHandoffOfferPending(history)) {
    return true
  }
  if (isDissatisfactionWithoutDefect(body)) return true
  if (hasOngoingSalesIntake(history) || isAwaitingSalesIntakeAnswer(history)) {
    return true
  }
  if (
    isServiceHandoffSummaryPending(history) ||
    isServiceOrderIdentificationFlow(history, body) ||
    isReturnPickupAwaitingThread(history, body) ||
    isPostPurchaseServiceFlow(history)
  ) {
    return true
  }
  if (isExchangeIntakeActive(history)) return true
  if (isActiveDigitalDocumentFlow(history, body)) return true
  if (isOrderLookupCompletedInThread(history) || isOrderConfirmationPending(history)) {
    return true
  }
  return false
}
