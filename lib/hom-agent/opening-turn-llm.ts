import {
  isActiveDigitalDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import {
  isExchangeIntakeActive,
  isExchangeIntakeStartedInThread,
} from "@/lib/agents/exchange-intake"
import {
  isNumberedReturnPolicyChoicePending,
  isOrderConfirmationPending,
  isOrderLookupPhoneReplyPending,
} from "@/lib/agents/order-lookup"
import {
  isConfirmationPending,
  isSalesPhotoRequestPending,
  turnHasCustomerImage,
} from "@/lib/agents/sales-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"

/**
 * LLM-first routing: skip structured intent shortcuts unless thread state already
 * defines the next step (phone confirm, order card, exchange quiz, document flow).
 * Disable with HOM_OPENING_TURN_LLM_ONLY=0 for emergency rollback.
 */
export function isOpeningTurnLlmOnlyEnabled(): boolean {
  const raw = process.env.HOM_OPENING_TURN_LLM_ONLY?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false
  }
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") {
    return true
  }
  return true
}

/** Structured pre-turn may run only when a pending binding step is already open. */
export function hasStructuredPendingStateBinding(
  history: HistoryMessage[],
  turn: UserTurn,
  body: string
): boolean {
  if (isOrderConfirmationPending(history)) return true
  if (isOrderLookupPhoneReplyPending(history)) return true
  if (isConfirmationPending(history)) return true
  if (isExchangeIntakeActive(history) || isExchangeIntakeStartedInThread(history)) {
    return true
  }
  if (isActiveDigitalDocumentFlow(history, body)) return true
  if (isNumberedReturnPolicyChoicePending(history, body)) return true
  if (isSalesPhotoRequestPending(history) && turnHasCustomerImage(turn)) {
    return true
  }
  return false
}

/** Skip structured FAQ/order/exchange shortcuts — LLM interprets intent unless pending state binds the turn. */
export function shouldDeferStructuredPreTurnToLlm(
  history: HistoryMessage[],
  turn: UserTurn
): boolean {
  if (!isOpeningTurnLlmOnlyEnabled()) return false
  const body = summarizeTurn(turn)
  if (hasStructuredPendingStateBinding(history, turn, body)) return false
  return true
}
