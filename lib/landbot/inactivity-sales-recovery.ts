import { buildHumanHandoffConfirmedReply } from "@/lib/agents/human-agent-hours"
import {
  clearInactivityWatchState,
  recordProactiveAssistantMessage,
} from "@/lib/agents/memory"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { assignToHuman, sendCustomerText, unassignCustomer } from "@/lib/landbot/client"
import {
  humanAgentIdForHandoff,
  recordHumanAgentActivity,
} from "@/lib/landbot/human-takeover"

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
  const human = humanAgentIdForHandoff("human_sales", input.customerId)
  const reply = buildInactivitySalesRecoveryReply()

  if (human) await assignToHuman(input.customerId, human)
  else await unassignCustomer(input.customerId)

  await sendCustomerText(input.customerId, reply)
  await recordProactiveAssistantMessage({
    conversationId: input.conversationId,
    assistantText: reply,
    action: "human_sales",
  })
  await clearInactivityWatchState(input.conversationId)
  await recordHumanAgentActivity(input.conversationId)

  return { ok: true as const, sent: "sales_recovery" as const }
}
