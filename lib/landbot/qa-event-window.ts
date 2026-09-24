import { getAgentSupabase } from "@/lib/agents/supabase"
import { safeConversationLookupId } from "@/lib/crm/conversation-lookup"

export type QaEventWindowReason =
  | "trainer_reset"
  | "agent_reset"
  | "opened_at"
  | "tail_fallback"

export type QaEventWindow = {
  since: string
  reason: QaEventWindowReason
  eventWindowMessageCount: number
  totalMessageCount: number
}

const TRAINER_RESET_PREFIX = "איפוס"
const TAIL_FALLBACK_MESSAGE_LIMIT = 40

type WindowCandidate = {
  since: string
  reason: QaEventWindowReason
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Date.parse(trimmed)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function normalizeTrainerResetBody(body: string) {
  return body
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function isTrainerResetMessage(body: string) {
  const trimmed = body.trim()
  if (!trimmed) return false
  if (normalizeTrainerResetBody(trimmed) === TRAINER_RESET_PREFIX) return true
  const firstLine = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean)[0]
  return firstLine === TRAINER_RESET_PREFIX
}

/** Pick the newest boundary — start of the current QA incident, not lifetime thread. */
export function pickQaEventWindow(input: {
  openedAt?: string | null
  agentResetAt?: string | null
  trainerResetAt?: string | null
  now?: Date
}): Pick<QaEventWindow, "since" | "reason"> {
  const candidates: WindowCandidate[] = []

  const openedAt = asIso(input.openedAt)
  if (openedAt) candidates.push({ since: openedAt, reason: "opened_at" })

  const agentResetAt = asIso(input.agentResetAt)
  if (agentResetAt) candidates.push({ since: agentResetAt, reason: "agent_reset" })

  const trainerResetAt = asIso(input.trainerResetAt)
  if (trainerResetAt) {
    candidates.push({ since: trainerResetAt, reason: "trainer_reset" })
  }

  if (candidates.length) {
    candidates.sort(
      (a, b) => Date.parse(b.since) - Date.parse(a.since)
    )
    return candidates[0]
  }

  const now = input.now ?? new Date()
  return {
    since: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    reason: "tail_fallback",
  }
}

async function countMessagesSince(sessionIds: string[], since: string) {
  const supabase = getAgentSupabase()
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .gte("sent_at", since)
  if (error) throw error
  return count ?? 0
}

async function resolveTailFallbackWindow(sessionIds: string[]) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("messages")
    .select("sent_at")
    .in("session_id", sessionIds)
    .not("body", "is", null)
    .order("sent_at", { ascending: false })
    .limit(TAIL_FALLBACK_MESSAGE_LIMIT)

  if (error) throw error
  const rows = data ?? []
  if (!rows.length) {
    return {
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      messageCount: 0,
    }
  }

  const oldest = rows[rows.length - 1]?.sent_at
  return {
    since: asIso(oldest) ?? new Date().toISOString(),
    messageCount: rows.length,
  }
}

async function findLatestTrainerResetAt(sessionIds: string[]) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("messages")
    .select("sent_at, body")
    .in("session_id", sessionIds)
    .eq("direction", "incoming")
    .ilike("body", `${TRAINER_RESET_PREFIX}%`)
    .order("sent_at", { ascending: false })
    .limit(5)

  if (error) throw error
  for (const row of data ?? []) {
    if (isTrainerResetMessage(String(row.body ?? ""))) {
      return asIso(row.sent_at)
    }
  }
  return null
}

export async function resolveQaEventWindow(
  conversationId: string
): Promise<QaEventWindow | null> {
  const lookupId = safeConversationLookupId(conversationId)
  if (!lookupId) return null

  const supabase = getAgentSupabase()
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "session_id, landbot_customer_id, conversation_ref, opened_at, message_count"
    )
    .or(
      `landbot_customer_id.eq.${lookupId},session_id.eq.${lookupId},conversation_ref.eq.${lookupId}`
    )
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (conversationError) throw conversationError
  if (!conversation?.session_id) return null

  const sessionId = String(conversation.session_id).trim()
  const sessionIds = Array.from(
    new Set(
      [lookupId, sessionId, conversation.landbot_customer_id, conversation.conversation_ref]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  )

  const [{ data: session }, trainerResetAt] = await Promise.all([
    supabase
      .from("hom_agent_sessions")
      .select("reset_at")
      .eq("conversation_id", sessionId)
      .maybeSingle(),
    findLatestTrainerResetAt(sessionIds),
  ])

  const picked = pickQaEventWindow({
    openedAt: asIso(conversation.opened_at),
    agentResetAt: asIso(session?.reset_at),
    trainerResetAt,
  })

  const totalFromDb = await countMessagesSince(
    sessionIds,
    "1970-01-01T00:00:00.000Z"
  )
  const totalMessageCount =
    typeof conversation.message_count === "number" && conversation.message_count > 0
      ? conversation.message_count
      : totalFromDb

  if (picked.reason === "tail_fallback") {
    const tail = await resolveTailFallbackWindow(sessionIds)
    return {
      since: tail.since,
      reason: picked.reason,
      eventWindowMessageCount: tail.messageCount,
      totalMessageCount,
    }
  }

  const eventWindowMessageCount = await countMessagesSince(
    sessionIds,
    picked.since
  )

  return {
    since: picked.since,
    reason: picked.reason,
    eventWindowMessageCount,
    totalMessageCount,
  }
}
