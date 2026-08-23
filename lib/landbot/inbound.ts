import { getAgentSupabase } from "@/lib/agents/supabase"

export async function claimInbound(messageKey: string, conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_inbound")
    .insert({ message_key: messageKey, conversation_id: conversationId })
    .select("message_key")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") return false
    throw error
  }
  return Boolean(data?.message_key)
}

export async function releaseInbound(messageKey: string) {
  const supabase = getAgentSupabase()
  await supabase.from("hom_agent_inbound").delete().eq("message_key", messageKey)
}
