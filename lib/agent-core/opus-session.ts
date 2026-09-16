import { getAgentSupabase } from "@/lib/agents/supabase"

function safeId(conversationId: string) {
  return conversationId.replace(/[,()]/g, "").slice(0, 200)
}

export async function getOpusEscalatedReason(conversationId: string) {
  try {
    const supabase = getAgentSupabase()
    const { data } = await supabase
      .from("hom_agent_sessions")
      .select("opus_escalated_reason")
      .eq("conversation_id", safeId(conversationId))
      .maybeSingle()
    const reason = data?.opus_escalated_reason
    return typeof reason === "string" && reason.trim() ? reason.trim() : null
  } catch {
    return null
  }
}

export async function setOpusEscalatedReason(
  conversationId: string,
  reason: string | null
) {
  try {
    const supabase = getAgentSupabase()
    await supabase.from("hom_agent_sessions").upsert(
      {
        conversation_id: safeId(conversationId),
        opus_escalated_reason: reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" }
    )
  } catch {
    // non-blocking
  }
}
