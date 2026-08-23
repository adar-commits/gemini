import { getAgentSupabase } from "@/lib/agents/supabase"
import type { AgentResponse } from "@/lib/agents/types"

export async function logShadowTurn(input: {
  conversationId: string
  customerId: number
  phone: string
  userText: string
  result: AgentResponse
  draftReply: string
  replied: boolean
}) {
  const supabase = getAgentSupabase()
  const { error } = await supabase.from("hom_agent_shadow_logs").insert({
    conversation_id: input.conversationId,
    customer_id: input.customerId,
    phone: input.phone || null,
    user_text: input.userText,
    agent: input.result.agent,
    action: input.result.action,
    draft_reply: input.draftReply,
    replied: input.replied,
  })
  if (error) throw error
}
