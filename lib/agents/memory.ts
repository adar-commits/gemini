import { getAgentSupabase } from "@/lib/agents/supabase"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"

const HISTORY_LIMIT = 10

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function safeId(value: string) {
  return value.replace(/[,()]/g, "").slice(0, 200)
}

export async function getHistory(conversationId: string): Promise<HistoryMessage[]> {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { data: session } = await supabase
    .from("hom_agent_sessions")
    .select("reset_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const resetAt = asText(session?.reset_at) || null

  const [stored, landbot] = await Promise.all([
    loadStoredMessages(conversationId, resetAt),
    loadLandbotMessages(conversationId, resetAt),
  ])

  const merged = [...landbot, ...stored].filter((item) => item.content)
  const unique: HistoryMessage[] = []
  for (const item of merged) {
    const prev = unique[unique.length - 1]
    if (prev && prev.role === item.role && prev.content === item.content) continue
    unique.push(item)
  }
  return unique.slice(-HISTORY_LIMIT)
}

async function loadStoredMessages(conversationId: string, resetAt: string | null) {
  const supabase = getAgentSupabase()
  let query = supabase
    .from("hom_agent_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40)

  if (resetAt) query = query.gt("created_at", resetAt)

  const { data, error } = await query
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: asText(row.content),
    }))
}

async function loadLandbotMessages(conversationId: string, resetAt: string | null) {
  const supabase = getAgentSupabase()
  const { data: sessions } = await supabase
    .from("conversations")
    .select("session_id")
    .or(
      `session_id.eq.${conversationId},conversation_ref.eq.${conversationId},landbot_customer_id.eq.${conversationId}`
    )
    .limit(5)

  const sessionIds = Array.from(
    new Set([conversationId, ...(sessions ?? []).map((row) => asText(row.session_id))])
  ).filter(Boolean)

  let query = supabase
    .from("messages")
    .select("body, sender_type, direction, sent_at")
    .in("session_id", sessionIds)
    .not("body", "is", null)
    .order("sent_at", { ascending: true })
    .limit(40)

  if (resetAt) query = query.gt("sent_at", resetAt)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row) => {
    const incoming =
      row.direction === "incoming" || row.sender_type === "customer"
    return {
      role: incoming ? ("user" as const) : ("assistant" as const),
      content: asText(row.body),
    }
  })
}

export async function appendTurn(input: {
  conversationId: string
  agent: AgentId
  userText: string
  assistantText: string
  action: string
}) {
  const conversationId = safeId(input.conversationId)
  const supabase = getAgentSupabase()
  const rows: Array<{
    conversation_id: string
    role: "user" | "assistant"
    content: string
    agent: AgentId
    action: string | null
  }> = [
    {
      conversation_id: conversationId,
      role: "user",
      content: input.userText,
      agent: input.agent,
      action: null,
    },
  ]

  if (input.assistantText || input.action !== "reply") {
    rows.push({
      conversation_id: conversationId,
      role: "assistant",
      content: input.assistantText,
      agent: input.agent,
      action: input.action,
    })
  }

  const { data: last } = await supabase
    .from("hom_agent_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const toInsert =
    last?.role === "user" && last.content === input.userText
      ? rows.filter((row) => row.role !== "user")
      : rows

  if (toInsert.length) {
    const { error } = await supabase.from("hom_agent_messages").insert(toInsert)
    if (error) throw error
  }

  if (input.action === "reset") {
    const { error } = await supabase.from("hom_agent_sessions").upsert({
      conversation_id: conversationId,
      reset_at: new Date().toISOString(),
      last_agent: input.agent,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return
  }

  const { error } = await supabase.from("hom_agent_sessions").upsert({
    conversation_id: conversationId,
    last_agent: input.agent,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
