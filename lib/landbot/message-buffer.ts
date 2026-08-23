import { getAgentSupabase } from "@/lib/agents/supabase"
import { mergeTurns, type UserTurn } from "@/lib/agents/user-turn"

const DEBOUNCE_MS = Number(process.env.LANDBOT_DEBOUNCE_MS ?? 3500)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function debounceWindowMs() {
  return Number.isFinite(DEBOUNCE_MS) && DEBOUNCE_MS > 0 ? DEBOUNCE_MS : 3500
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

/** Wait until the buffer has been quiet for debounceWindowMs since the last customer message. */
export async function waitAndTakeBufferedTurn(
  conversationId: string
): Promise<UserTurn | null> {
  const window = debounceWindowMs()
  const pollMs = 250
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const supabase = getAgentSupabase()
    const { data, error } = await supabase
      .from("hom_agent_message_buffer")
      .select("updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle()

    if (error) throw error
    if (!data?.updated_at) return null

    const quietMs = Date.now() - new Date(String(data.updated_at)).getTime()
    if (quietMs >= window) break

    await sleep(Math.min(pollMs, Math.max(50, window - quietMs)))
  }

  const supabase = getAgentSupabase()
  const { data: snapshot, error: readError } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (readError) throw readError
  if (!snapshot?.parts || !Array.isArray(snapshot.parts) || snapshot.parts.length === 0) {
    return null
  }

  const quietMs = Date.now() - new Date(String(snapshot.updated_at)).getTime()
  if (quietMs < window) return null

  const { data: claimed, error: claimError } = await supabase
    .from("hom_agent_message_buffer")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("updated_at", snapshot.updated_at)
    .select("parts")
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed?.parts || !Array.isArray(claimed.parts)) return null

  return mergeTurns(claimed.parts as UserTurn[])
}
