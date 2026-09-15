import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import {
  isActiveSalesConsultation,
  isSalesFinalSummaryPending,
} from "@/lib/agents/sales-intake"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"

function isPendingServiceHandoffSummary(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return /מסכם\s+את\s+הפנייה|עבור\s+נציג\s+שירות/i.test(message.content)
  }
  return false
}

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
 * Sales threads and pending handoffs: never send "עדיין כאן?". After the quiet
 * window, inactivity recovery silently assigns human_sales (sales quiz / מכירות)
 * or human_service (service summary pending).
 */
export function shouldSkipInactivityPingForSalesHandoff(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (isActiveSalesConsultation(history, lastAgent)) return true
  if (isSalesFinalSummaryPending(history)) return true
  if (isPendingServiceHandoffSummary(history)) return true
  if (isHumanHandoffPending(history)) return true
  return false
}
