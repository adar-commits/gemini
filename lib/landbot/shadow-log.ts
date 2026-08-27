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
  const metrics = input.result.metrics
  const { error } = await supabase.from("hom_agent_shadow_logs").insert({
    conversation_id: input.conversationId,
    customer_id: input.customerId,
    phone: input.phone || null,
    user_text: input.userText,
    agent: input.result.agent,
    action: input.result.action,
    draft_reply: input.draftReply,
    replied: input.replied,
    latency_ms: metrics?.latency_ms ?? null,
    llm_calls: metrics?.llm_calls ?? null,
    models_used: metrics?.models_used ?? null,
    tier: metrics?.tier ?? null,
    profile: metrics?.profile ?? null,
    fallback_layer: metrics?.fallback_layer ?? null,
  })
  if (error) throw error
}
