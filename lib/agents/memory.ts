import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  isSpecialistId,
  type AgentId,
  type HistoryMessage,
} from "@/lib/agents/types"

const HISTORY_LIMIT = 10

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function safeId(value: string) {
  return value.replace(/[,()]/g, "").slice(0, 200)
}

export type ConversationContext = {
  history: HistoryMessage[]
  lastAgent: AgentId | null
  lastAction: string | null
  resetAt: string | null
}

function asAgentId(value: unknown): AgentId | null {
  const text = asText(value)
  if (
    text === "master" ||
    text === "sales" ||
    text === "faq" ||
    text === "service"
  ) {
    return text
  }
  return null
}

export async function getConversationContext(
  conversationId: string
): Promise<ConversationContext> {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { data: session } = await supabase
    .from("hom_agent_sessions")
    .select("reset_at, last_agent")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const resetAt = asText(session?.reset_at) || null
  const stored = await loadStoredMessages(conversationId, resetAt)
  const lastStored = [...stored].reverse().find((row) => row.action || row.agent)
  const lastAgent =
    asAgentId(lastStored?.agent) ?? asAgentId(session?.last_agent)
  const lastAction = asText(lastStored?.action) || null

  const storedHistory = stored
    .filter((item) => item.content)
    .map((item) => ({ role: item.role, content: item.content }))

  if (resetAt) {
    return {
      history: dedupeHistory(storedHistory).slice(-HISTORY_LIMIT),
      lastAgent,
      lastAction,
      resetAt,
    }
  }

  if (storedHistory.length >= 2 || (lastAgent && isSpecialistId(lastAgent))) {
    return {
      history: dedupeHistory(storedHistory).slice(-HISTORY_LIMIT),
      lastAgent,
      lastAction,
      resetAt,
    }
  }

  const landbot = await loadLandbotMessages(conversationId, resetAt)
  return {
    history: dedupeHistory([...landbot, ...storedHistory]).slice(-HISTORY_LIMIT),
    lastAgent,
    lastAction,
    resetAt,
  }
}

export async function getHistory(conversationId: string): Promise<HistoryMessage[]> {
  return (await getConversationContext(conversationId)).history
}

export type ConversationTail = {
  latestRole: "user" | "assistant" | null
  latestContent: string | null
  latestUserMessage: string | null
}

export async function getConversationTail(
  conversationId: string
): Promise<ConversationTail> {
  const { history } = await getConversationContext(conversationId)
  const last = history[history.length - 1]
  const lastUser = [...history].reverse().find((message) => message.role === "user")
  return {
    latestRole: last?.role ?? null,
    latestContent: last?.content?.trim() || null,
    latestUserMessage: lastUser?.content?.trim() || null,
  }
}

export function normalizeMessageText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function dedupeHistory(items: HistoryMessage[]) {
  const unique: HistoryMessage[] = []
  for (const item of items) {
    const prev = unique[unique.length - 1]
    if (prev && prev.role === item.role && prev.content === item.content) continue
    unique.push(item)
  }
  return unique
}

async function loadStoredMessages(conversationId: string, resetAt: string | null) {
  const supabase = getAgentSupabase()
  let query = supabase
    .from("hom_agent_messages")
    .select("role, content, created_at, agent, action")
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
      agent: asText(row.agent),
      action: asText(row.action),
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
  persistUser?: boolean
  preview?: boolean
}): Promise<{ assistantInserted: boolean }> {
  if (input.preview) return { assistantInserted: false }

  const conversationId = safeId(input.conversationId)
  const persistUser = input.persistUser !== false
  const supabase = getAgentSupabase()
  let assistantInserted = false
  const rows: Array<{
    conversation_id: string
    role: "user" | "assistant"
    content: string
    agent: AgentId
    action: string | null
  }> = persistUser
    ? [
        {
          conversation_id: conversationId,
          role: "user",
          content: input.userText,
          agent: input.agent,
          action: null,
        },
      ]
    : []

  if (input.assistantText || input.action !== "reply") {
    let skipDuplicate = false

    if (input.assistantText?.trim()) {
      const { data: lastAssistant } = await supabase
        .from("hom_agent_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      skipDuplicate =
        Boolean(lastAssistant?.content) &&
        normalizeMessageText(String(lastAssistant?.content)) ===
          normalizeMessageText(input.assistantText)
    }

    if (!skipDuplicate) {
      rows.push({
        conversation_id: conversationId,
        role: "assistant",
        content: input.assistantText,
        agent: input.agent,
        action: input.action,
      })
      assistantInserted = true
    }
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
  } else {
    assistantInserted = false
  }

  const clearSticky =
    input.action === "reset" ||
    input.action === "end" ||
    input.action === "shipping"

  const session: Record<string, string> = {
    conversation_id: conversationId,
    last_agent: clearSticky ? "master" : input.agent,
    updated_at: new Date().toISOString(),
  }
  if (input.action === "reset") {
    session.reset_at = new Date().toISOString()
  }

  const { error } = await supabase.from("hom_agent_sessions").upsert(session)
  if (error) throw error

  return { assistantInserted }
}
