import { runMasterConversation } from "@/lib/agents/run-agent"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  assignToApiAgent,
  assignToHuman,
  sendCustomerText,
  unassignCustomer,
} from "@/lib/landbot/client"
import type { AgentResponse } from "@/lib/agents/types"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"

function outboundReply(result: AgentResponse) {
  if (result.reply) return result.reply
  if (result.action === "human_service") {
    return "*הום בוט :)*\nהפנייה הועברה לנציג שירות. ניצור קשר בהקדם."
  }
  if (result.action === "human_sales") {
    return "*הום בוט :)*\nהפנייה הועברה ליועץ מכירות. ניצור קשר בהקדם."
  }
  return ""
}

export async function handleLandbotInbound(
  customerId: number,
  conversationId: string,
  turn: UserTurn
): Promise<AgentResponse> {
  await assignToApiAgent(customerId)
  const result = await runMasterConversation(conversationId, turn)

  const reply = outboundReply(result)
  if (reply) {
    await sendCustomerText(customerId, reply)
  }

  if (result.action === "human_sales" || result.action === "human_service") {
    const human = pickHumanAgentId(result.action, customerId)
    if (human) await assignToHuman(customerId, human)
    else await unassignCustomer(customerId)
  }

  return result
}
