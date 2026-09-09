import { setCrmConversationDepartment, type HandoffAction } from "@/lib/crm/conversation-department"
import { assignToHuman, unassignCustomer } from "@/lib/landbot/client"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"
import { recordHumanAgentActivity } from "@/lib/landbot/human-takeover"

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
    const dept = await setCrmConversationDepartment({
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

  const human = pickHumanAgentId(input.action, input.customerId)
  if (human) await assignToHuman(input.customerId, human)
  else await unassignCustomer(input.customerId)

  await recordHumanAgentActivity(input.conversationId)
}
