import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
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
