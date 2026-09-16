import { isFirstSubstantiveCustomerTurn } from "@/lib/agents/greeting"
import type { HistoryMessage } from "@/lib/agents/types"

/**
 * Opening customer messages route through the LLM (no structured FAQ/order shortcuts).
 * Disable with HOM_OPENING_TURN_LLM_ONLY=0 for emergency rollback without redeploying code.
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

/** Skip structured pre-turn shortcuts on the first substantive customer message. */
export function shouldDeferStructuredPreTurnToLlm(
  history: HistoryMessage[]
): boolean {
  if (!isOpeningTurnLlmOnlyEnabled()) return false
  return isFirstSubstantiveCustomerTurn(history)
}
