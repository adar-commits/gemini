import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import {
  isActiveSalesConsultation,
  isSalesFinalSummaryPending,
} from "@/lib/agents/sales-intake"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"

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
