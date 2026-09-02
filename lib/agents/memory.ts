import { getAgentSupabase } from "@/lib/agents/supabase"
import {
  isSpecialistId,
  type AgentId,
  type HistoryMessage,
} from "@/lib/agents/types"

import { getRuntimeConfig } from "@/lib/agent-core/runtime-config"

const DEFAULT_HISTORY_LIMIT = 40

async function historyLimit() {
  try {
    const runtime = await getRuntimeConfig()
    return runtime.historyLimit
  } catch {
    return DEFAULT_HISTORY_LIMIT
  }
}

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
  inactivityClosedAt: string | null
  conversationSummary: string | null
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
    .select("reset_at, last_agent, inactivity_closed_at, conversation_summary")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const resetAt = asText(session?.reset_at) || null
  const inactivityClosedAt = asText(session?.inactivity_closed_at) || null
  const conversationSummary = asText(session?.conversation_summary) || null
  const limit = await historyLimit()
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
      history: dedupeHistory(storedHistory).slice(-limit),
      lastAgent,
      lastAction,
      resetAt,
      inactivityClosedAt,
      conversationSummary,
    }
  }

  if (storedHistory.length >= 2 || (lastAgent && isSpecialistId(lastAgent))) {
    return {
      history: dedupeHistory(storedHistory).slice(-limit),
      lastAgent,
      lastAction,
      resetAt,
      inactivityClosedAt,
      conversationSummary,
    }
  }

  const landbot = await loadLandbotMessages(conversationId, resetAt)
  return {
    history: dedupeHistory([...landbot, ...storedHistory]).slice(-limit),
    lastAgent,
    lastAction,
    resetAt,
    inactivityClosedAt,
    conversationSummary,
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

type SessionMetaPatch = {
  customerName?: string
  customerPhone?: string
  lastUserAt?: string
  lastAssistantAt?: string
  clearInactivity?: boolean
  inactivityClosedAt?: string | null
  inactivityPingSentAt?: string | null
}

export async function touchSessionMeta(
  conversationId: string,
  input: {
    customerName?: string
    customerPhone?: string
  }
) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const patch: Record<string, string | null> = {
    conversation_id: conversationId,
    updated_at: new Date().toISOString(),
  }

  if (input.customerName?.trim()) patch.customer_name = input.customerName.trim()
  if (input.customerPhone?.trim()) patch.customer_phone = input.customerPhone.trim()

  const { error } = await supabase.from("hom_agent_sessions").upsert(patch)
  if (error) throw error
}

async function patchSession(conversationId: string, patch: SessionMetaPatch) {
  const supabase = getAgentSupabase()
  const row: Record<string, string | null> = {
    conversation_id: conversationId,
    updated_at: new Date().toISOString(),
  }

  if (patch.lastUserAt) row.last_user_at = patch.lastUserAt
  if (patch.lastAssistantAt) row.last_assistant_at = patch.lastAssistantAt
  if (patch.clearInactivity) {
    row.inactivity_ping_sent_at = null
    row.inactivity_closed_at = null
  }
  if (patch.inactivityClosedAt !== undefined) {
    row.inactivity_closed_at = patch.inactivityClosedAt
  }
  if (patch.inactivityPingSentAt !== undefined) {
    row.inactivity_ping_sent_at = patch.inactivityPingSentAt
  }

  const { error } = await supabase.from("hom_agent_sessions").upsert(row)
  if (error) throw error
}

export async function recordProactiveAssistantMessage(input: {
  conversationId: string
  assistantText: string
  action: string
}) {
  const conversationId = safeId(input.conversationId)
  const supabase = getAgentSupabase()
  const now = new Date().toISOString()

  const { error: insertError } = await supabase.from("hom_agent_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: input.assistantText,
    agent: "master",
    action: input.action,
  })
  if (insertError) throw insertError

  await patchSession(conversationId, {
    lastAssistantAt: now,
    inactivityClosedAt:
      input.action === "inactivity_close" ? now : undefined,
    inactivityPingSentAt:
      input.action === "inactivity_ping" ? now : undefined,
  })
}

export async function clearInactivityWatchState(conversationId: string) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { error } = await supabase
    .from("hom_agent_sessions")
    .update({
      inactivity_ping_sent_at: null,
      inactivity_closed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)

  if (error) throw error
}

export async function getSessionInactivityState(conversationId: string) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select(
      "last_assistant_at, last_user_at, inactivity_ping_sent_at, inactivity_closed_at, customer_name, customer_phone, human_agent_last_at"
    )
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getHumanTakeoverState(conversationId: string) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select("human_agent_last_at, last_user_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function markHumanAgentActivity(conversationId: string, at?: string) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const now = at ?? new Date().toISOString()
  const { error } = await supabase.from("hom_agent_sessions").upsert({
    conversation_id: conversationId,
    human_agent_last_at: now,
    updated_at: now,
  })
  if (error) throw error
}

export async function clearHumanAgentActivity(conversationId: string) {
  conversationId = safeId(conversationId)
  const supabase = getAgentSupabase()
  const { error } = await supabase
    .from("hom_agent_sessions")
    .update({
      human_agent_last_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)

  if (error) throw error
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
  const nowMs = Date.now()
  const userCreatedAt = new Date(nowMs).toISOString()
  const assistantCreatedAt = new Date(nowMs + 1).toISOString()
  const rows: Array<{
    conversation_id: string
    role: "user" | "assistant"
    content: string
    agent: AgentId
    action: string | null
    created_at?: string
  }> = persistUser
    ? [
        {
          conversation_id: conversationId,
          role: "user",
          content: input.userText,
          agent: input.agent,
          action: null,
          created_at: userCreatedAt,
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
        created_at:
          persistUser && input.userText.trim() ? assistantCreatedAt : userCreatedAt,
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
    input.action === "inactivity_close" ||
    input.action === "shipping"

  const now = userCreatedAt
  const session: Record<string, string | null> = {
    conversation_id: conversationId,
    last_agent: clearSticky ? "master" : input.agent,
    updated_at: now,
  }
  if (input.action === "reset") {
    session.reset_at = now
    session.inactivity_ping_sent_at = null
    session.inactivity_closed_at = null
  }
  if (persistUser && input.userText.trim()) {
    session.last_user_at = now
    session.inactivity_ping_sent_at = null
    session.inactivity_closed_at = null
  }
  if (assistantInserted && input.assistantText.trim()) {
    session.last_assistant_at =
      persistUser && input.userText.trim() ? assistantCreatedAt : now
  }
  if (input.action === "inactivity_close") {
    session.inactivity_closed_at = now
  }

  const { error } = await supabase.from("hom_agent_sessions").upsert(session)
  if (error) throw error

  return { assistantInserted }
}

export async function appendMultiReplyTurn(input: {
  conversationId: string
  agent: AgentId
  userText: string
  assistantTexts: string[]
  action: string
  persistUser?: boolean
  preview?: boolean
}): Promise<{ assistantInserted: boolean }> {
  const texts = input.assistantTexts.map((text) => text.trim()).filter(Boolean)
  if (texts.length <= 1) {
    return appendTurn({
      ...input,
      assistantText: texts[0] ?? "",
    })
  }

  if (input.preview) return { assistantInserted: false }

  const conversationId = safeId(input.conversationId)
  const persistUser = input.persistUser !== false
  const supabase = getAgentSupabase()
  const nowMs = Date.now()
  const userCreatedAt = new Date(nowMs).toISOString()
  const rows: Array<{
    conversation_id: string
    role: "user" | "assistant"
    content: string
    agent: AgentId
    action: string | null
    created_at?: string
  }> = persistUser
    ? [
        {
          conversation_id: conversationId,
          role: "user",
          content: input.userText,
          agent: input.agent,
          action: null,
          created_at: userCreatedAt,
        },
      ]
    : []

  texts.forEach((text, index) => {
    rows.push({
      conversation_id: conversationId,
      role: "assistant",
      content: text,
      agent: input.agent,
      action: index === texts.length - 1 ? input.action : "reply",
      created_at: new Date(nowMs + index + 1).toISOString(),
    })
  })

  const { error: insertError } = await supabase.from("hom_agent_messages").insert(rows)
  if (insertError) throw insertError

  const lastAssistantAt = new Date(nowMs + texts.length).toISOString()
  const session: Record<string, string | null> = {
    conversation_id: conversationId,
    last_agent: input.agent,
    updated_at: lastAssistantAt,
  }
  if (persistUser && input.userText.trim()) {
    session.last_user_at = userCreatedAt
    session.inactivity_ping_sent_at = null
    session.inactivity_closed_at = null
  }
  session.last_assistant_at = lastAssistantAt

  const { error: sessionError } = await supabase.from("hom_agent_sessions").upsert(session)
  if (sessionError) throw sessionError

  return { assistantInserted: true }
}
