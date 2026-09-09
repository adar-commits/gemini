import { buildHumanHandoffConfirmedReply } from "@/lib/agents/human-agent-hours"
import {
  clearInactivityWatchState,
  recordProactiveAssistantMessage,
} from "@/lib/agents/memory"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { sendCustomerText } from "@/lib/landbot/client"
import { executeHumanHandoff } from "@/lib/landbot/human-handoff"

function buildInactivitySalesRecoveryReply(now = new Date()) {
  const body = buildHumanHandoffConfirmedReply("human_sales", now)
  return `${CUSTOMER_HEADER}\n${body}`
}

/**
 * Silent sales-funnel timeout: assign to מכירות instead of closing or leaving
 * the thread orphaned after "עדיין כאן?" with no reply.
 */
export async function executeInactivitySalesRecovery(input: {
  conversationId: string
  customerId: number
}) {
  const reply = buildInactivitySalesRecoveryReply()

  await executeHumanHandoff({
    conversationId: input.conversationId,
    customerId: input.customerId,
    action: "human_sales",
  })

  await sendCustomerText(input.customerId, reply)
  await recordProactiveAssistantMessage({
    conversationId: input.conversationId,
    assistantText: reply,
    action: "human_sales",
  })
  await clearInactivityWatchState(input.conversationId)

  return { ok: true as const, sent: "sales_recovery" as const }
}
