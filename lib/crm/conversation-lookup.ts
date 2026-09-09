import { getAgentSupabase } from "@/lib/agents/supabase"

export function safeConversationLookupId(conversationId: string) {
  return conversationId.trim().replace(/[^\dA-Za-z_-]/g, "")
}

export async function findCrmConversation(conversationId: string) {
  const lookupId = safeConversationLookupId(conversationId)
  if (!lookupId) return null

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("conversations")
    .select("session_id, department, inquiry_type, landbot_customer_id, closed_at")
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
