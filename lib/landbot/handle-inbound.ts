import { runMasterConversation } from "@/lib/agents/run-agent"
import type { UserTurn } from "@/lib/agents/user-turn"
import { summarizeTurn } from "@/lib/agents/user-turn"
import {
  assignToApiAgent,
  assignToHuman,
  sendCustomerText,
  unassignCustomer,
} from "@/lib/landbot/client"
import { pickHumanAgentId } from "@/lib/landbot/human-agents"
import { logShadowTurn } from "@/lib/landbot/shadow-log"
import type { AgentResponse } from "@/lib/agents/types"

export type InboundMode = "reply" | "shadow"

export type LandbotInboundResult = AgentResponse & {
  mode: InboundMode
  draft_reply?: string
}

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
  turn: UserTurn,
  options?: { replyEnabled?: boolean; phone?: string }
): Promise<LandbotInboundResult> {
  const replyEnabled = options?.replyEnabled !== false
  const mode: InboundMode = replyEnabled ? "reply" : "shadow"

  if (replyEnabled) {
    await assignToApiAgent(customerId)
  }

  const result = await runMasterConversation(conversationId, turn)
  const draftReply = outboundReply(result)

  if (replyEnabled) {
    if (draftReply) {
      await sendCustomerText(customerId, draftReply)
    }

    if (result.action === "human_sales" || result.action === "human_service") {
      const human = pickHumanAgentId(result.action, customerId)
      if (human) await assignToHuman(customerId, human)
      else await unassignCustomer(customerId)
    }
  } else {
    await logShadowTurn({
      conversationId,
      customerId,
      phone: options?.phone?.trim() || "",
      userText: summarizeTurn(turn),
      result,
      draftReply,
      replied: false,
    })
  }

  return {
    ...result,
    mode,
    draft_reply: draftReply || undefined,
  }
}
