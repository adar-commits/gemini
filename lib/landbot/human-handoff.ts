import {
  setCrmConversationDepartmentForHandoff,
  type HandoffAction,
} from "@/lib/crm/conversation-department"
import { findCrmConversation } from "@/lib/crm/conversation-lookup"
import { assignToHuman, unassignCustomer } from "@/lib/landbot/client"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"
import {
  isAssignedToHumanAgent,
  recordHumanAgentActivity,
} from "@/lib/landbot/human-takeover"

/**
 * Human handoff = CRM department (actual system) + optional Landbot rep assign.
 * Department is always attempted; Landbot assign is best-effort when IDs are configured.
 */
export async function executeHumanHandoff(input: {
  conversationId: string
  customerId: number
  action: HandoffAction
}) {
  try {
    const dept = await setCrmConversationDepartmentForHandoff({
      conversationId: input.conversationId,
      action: input.action,
    })
    if (dept.ok && dept.updated) {
      console.log("[human-handoff] crm department set", {
        conversationId: input.conversationId,
        department: dept.department,
        sessionId: dept.sessionId,
      })
    }
  } catch (error) {
    console.warn("[human-handoff] crm department failed", {
      conversationId: input.conversationId,
      action: input.action,
      error: error instanceof Error ? error.message : error,
    })
  }

  const human = await resolveHandoffHumanAgentId(input)
  if (human) await assignToHuman(input.customerId, human)
  else await unassignCustomer(input.customerId)

  await recordHumanAgentActivity(input.conversationId)
}

/** Keep the rep already on the thread (e.g. outreach template) instead of round-robin. */
async function resolveHandoffHumanAgentId(input: {
  conversationId: string
  action: HandoffAction
  customerId: number
}) {
  const row = await findCrmConversation(input.conversationId).catch(() => null)
  const crmAgentId = Number(row?.assigned_agent_code)
  if (isAssignedToHumanAgent(crmAgentId)) return crmAgentId
  return pickHumanAgentId(input.action, input.customerId)
}
