import {
  INACTIVITY_HANDOFF_AUTO_ASSIGN_MS,
  INACTIVITY_PING_MS,
} from "@/lib/agents/inactivity"
import { isActiveInventoryThread } from "@/lib/agents/inventory-lookup"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import {
  isActiveSalesConsultation,
  isSalesFinalSummaryPending,
} from "@/lib/agents/sales-intake"
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
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

/**
 * Pending human queue — never "עדיין כאן?". After the quiet window, silently assign
 * (sales intake, handoff offer, or service summary awaiting confirm).
 */
export function shouldSilentAutoAssignOnQuietWindow(
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (shouldSkipInactivityPingForSalesHandoff(history, lastAgent)) return true
  if (isHumanHandoffPending(history)) return true
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
