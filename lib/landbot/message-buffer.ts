import { getAgentSupabase } from "@/lib/agents/supabase"
import { mergeTurns, type UserTurn } from "@/lib/agents/user-turn"

const DEBOUNCE_MS = Number(process.env.LANDBOT_DEBOUNCE_MS ?? 3000)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function debounceWindowMs() {
  return Number.isFinite(DEBOUNCE_MS) && DEBOUNCE_MS > 0 ? DEBOUNCE_MS : 3000
}

export async function enqueueCustomerTurn(conversationId: string, turn: UserTurn) {
  const supabase = getAgentSupabase()
  const { data: existing } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const parts = Array.isArray(existing?.parts) ? [...existing.parts, turn] : [turn]
  const updatedAt = new Date().toISOString()

  const { error } = await supabase.from("hom_agent_message_buffer").upsert({
    conversation_id: conversationId,
    parts,
    updated_at: updatedAt,
  })
  if (error) throw error
  return updatedAt
}

export async function waitAndTakeBufferedTurn(
  conversationId: string,
  enqueuedAt: string
): Promise<UserTurn | null> {
  await sleep(debounceWindowMs())

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) throw error
  if (!data?.parts || !Array.isArray(data.parts) || data.parts.length === 0) {
    return null
  }

  if (data.updated_at > enqueuedAt) {
    return null
  }

  const turn = mergeTurns(data.parts as UserTurn[])
  await supabase
    .from("hom_agent_message_buffer")
    .delete()
    .eq("conversation_id", conversationId)

  return turn
}
