import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import {
  inferHumanHandoffAction,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import {
  isActiveSalesConsultation,
  isSalesFinalSummaryPending,
} from "@/lib/agents/sales-intake"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"

/**
 * Sales / inventory threads may get "עדיין כאן?" but never auto-close.
 * After the post-ping silence window, inactivity recovery assigns human_sales
 * instead of closing. Service and unknown flows keep ping + close.
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
 * Sales summary / handoff-offer: skip "עדיין כאן?" — assign human_sales after
 * the normal quiet window so hot leads are not cooled down.
 */
export function shouldSkipInactivityPingForSalesHandoff(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (isSalesFinalSummaryPending(history)) return true
  if (
    isHumanHandoffPending(history) &&
    inferHumanHandoffAction(history, lastAgent) === "human_sales"
  ) {
    return true
  }
  return false
}
