import { executeInactivitySilentQueueRecovery } from "@/lib/landbot/inactivity-handoff-recovery"

/**
 * Sales-funnel timeout: silently assign to מכירות (no "עדיין כאן?" and no
 * after-hours handoff message).
 */
export async function executeInactivitySalesRecovery(input: {
  conversationId: string
  customerId: number
}) {
  return executeInactivitySilentQueueRecovery(input)
}
