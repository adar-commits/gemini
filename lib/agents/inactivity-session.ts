import { getAgentSupabase } from "@/lib/agents/supabase"

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function botIsWaitingFromTimestamps(session: {
  last_user_at?: unknown
  last_assistant_at?: unknown
}) {
  const lastUser = asText(session.last_user_at)
  const lastAssistant = asText(session.last_assistant_at)
  if (!lastAssistant) return false
  if (!lastUser) return true
  return Date.parse(lastAssistant) >= Date.parse(lastUser)
}

/** Prefer the last message role — session timestamps can drift after duplicate persists. */
export async function isBotWaitingForCustomerReply(
  conversationId: string,
  session: {
    last_user_at?: unknown
    last_assistant_at?: unknown
  }
) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("role")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data?.role === "assistant") return true
  if (data?.role === "user") return false
  return botIsWaitingFromTimestamps(session)
}
