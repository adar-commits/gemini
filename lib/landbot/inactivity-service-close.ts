import { buildInactivityCloseReply } from "@/lib/agents/inactivity"
import { isLiveHumanLastOutbound, recordProactiveAssistantMessage } from "@/lib/agents/memory"
import { scheduleGokuTrainer } from "@/lib/agents/goku-trainer"
import { closeCrmConversation, crmCloseBlockedByHuman } from "@/lib/crm/conversation-close"
import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { archiveCustomer, assignToApiAgent, sendCustomerText } from "@/lib/landbot/client"

/**
 * Service / unknown flow: customer message + CRM close + Landbot archive.
 * Sales funnels must never call this — use inactivity sales recovery instead.
 */
export async function executeInactivityServiceClose(input: {
  conversationId: string
  customerId: number
}) {
  const reply = buildInactivityCloseReply()

  const crmRow = await findCrmConversation(input.conversationId).catch(() => null)
  const liveHumanLastOutbound = await isLiveHumanLastOutbound(input.conversationId).catch(
    () => true
  )
  if (
    crmCloseBlockedByHuman({
      assignedAgentCode: crmRow?.assigned_agent_code,
      liveHumanLastOutbound,
    })
  ) {
    console.log("[inactivity-close] skipped — human handling", input.conversationId)
    return { ok: true as const, skipped: "human_handling" as const }
  }

  await assignToApiAgent(input.customerId)
  await sendCustomerText(input.customerId, reply)
  await recordProactiveAssistantMessage({
    conversationId: input.conversationId,
    assistantText: reply,
    action: "inactivity_close",
  })

  try {
    const closed = await closeCrmConversation({
      conversationId: input.conversationId,
      reason: "inactivity_close",
    })
    if (closed.ok && closed.updated) {
      console.log("[inactivity-close] crm conversation closed", {
        conversationId: input.conversationId,
        sessionId: closed.sessionId,
      })
    }
  } catch (error) {
    console.warn("[inactivity-close] crm close failed", {
      conversationId: input.conversationId,
      error: error instanceof Error ? error.message : error,
    })
  }

  await archiveCustomer(input.customerId).catch((error) =>
    console.warn("[inactivity-close] landbot archive failed", {
      conversationId: input.conversationId,
      error: error instanceof Error ? error.message : error,
    })
  )

  scheduleGokuTrainer(input.conversationId, "inactivity_close")

  return { ok: true as const, sent: "close" as const }
}
