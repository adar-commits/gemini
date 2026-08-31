import { getAgentSupabase } from "@/lib/agents/supabase"

/** Max time one webhook holds exclusive drain rights for a conversation. */
export const PROCESSOR_LEASE_MS = 120_000

const PROCESSOR_WAIT_MS = 120_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function processorKey(conversationId: string) {
  return `processor:${conversationId}`
}

/** One active processor per conversation — other webhooks enqueue and exit. */
export async function claimConversationProcessor(conversationId: string) {
  const supabase = getAgentSupabase()
  const key = processorKey(conversationId)
  const staleBefore = new Date(Date.now() - PROCESSOR_LEASE_MS).toISOString()

  await supabase
    .from("hom_agent_inbound")
    .delete()
    .eq("message_key", key)
    .lt("created_at", staleBefore)

  const { error } = await supabase.from("hom_agent_inbound").insert({
    message_key: key,
    conversation_id: conversationId,
  })

  if (error?.code === "23505") return false
  if (error) throw error
  return true
}

export async function releaseConversationProcessor(conversationId: string) {
  const supabase = getAgentSupabase()
  await supabase.from("hom_agent_inbound").delete().eq("message_key", processorKey(conversationId))
}

/** Wait until this webhook can drain the buffer (prior processor finished). */
export async function waitForConversationProcessor(
  conversationId: string,
  deadlineMs = PROCESSOR_WAIT_MS
) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (await claimConversationProcessor(conversationId)) return true
    await sleep(200)
  }
  return false
}
