import { runMasterConversation } from "@/lib/agents/run-agent"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  assignToApiAgent,
  assignToHuman,
  sendCustomerText,
  unassignCustomer,
} from "@/lib/landbot/client"
import type { AgentResponse } from "@/lib/agents/types"

function humanAgentId() {
  const raw = process.env.LANDBOT_HUMAN_AGENT_ID?.trim()
  const id = raw ? Number(raw) : NaN
  return Number.isFinite(id) ? id : null
}

export async function handleLandbotInbound(
  customerId: number,
  conversationId: string,
  turn: UserTurn
): Promise<AgentResponse> {
  await assignToApiAgent(customerId)
  const result = await runMasterConversation(conversationId, turn)

  if (result.reply) {
    await sendCustomerText(customerId, result.reply)
  }

  if (result.action === "human_sales" || result.action === "human_service") {
    const human = humanAgentId()
    if (human) await assignToHuman(customerId, human)
    else await unassignCustomer(customerId)
  }

  return result
}
