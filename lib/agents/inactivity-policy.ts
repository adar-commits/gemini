import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"

/**
 * Sales threads may get "עדיין כאן?" but never auto-close — a human sales advisor
 * can still recover the lead. Service and unknown flows keep ping + close.
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
