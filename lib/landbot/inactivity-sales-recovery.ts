import { getConversationContext } from "@/lib/agents/memory"
import { executeInactivityHandoffRecovery } from "@/lib/landbot/inactivity-handoff-recovery"

/**
 * Sales-funnel timeout: silently assign to מכירות (no "עדיין כאן?" and no
 * after-hours handoff message).
 */
export async function executeInactivitySalesRecovery(input: {
  conversationId: string
  customerId: number
}) {
  const context = await getConversationContext(input.conversationId)
  return executeInactivityHandoffRecovery({
    ...input,
    history: context.history,
    lastAgent: context.lastAgent,
    silent: true,
  })
}
