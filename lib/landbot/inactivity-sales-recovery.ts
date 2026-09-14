import { getConversationContext } from "@/lib/agents/memory"
import { executeInactivityHandoffRecovery } from "@/lib/landbot/inactivity-handoff-recovery"

/**
 * Silent sales-funnel timeout: assign to מכירות instead of closing or leaving
 * the thread orphaned after "עדיין כאן?" with no reply.
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
  })
}
