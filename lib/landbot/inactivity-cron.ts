import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
  buildInactivityCloseReply,
  buildInactivityPingReply,
} from "@/lib/agents/inactivity"
import { recordProactiveAssistantMessage, touchSessionMeta } from "@/lib/agents/memory"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { shouldReplyPhone } from "@/lib/landbot/allowlist"
import { assignToApiAgent, sendCustomerText } from "@/lib/landbot/client"

type IdleSessionRow = {
  conversation_id: string
  last_user_at: string | null
  last_assistant_at: string | null
  inactivity_ping_sent_at: string | null
  inactivity_closed_at: string | null
  customer_name: string | null
  customer_phone: string | null
  last_action: string | null
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function parseCustomerId(conversationId: string) {
  const id = Number(conversationId)
  return Number.isFinite(id) && id > 0 ? id : null
}

function msSince(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY
  return Date.now() - ms
}

function botIsWaiting(row: IdleSessionRow) {
  const lastUser = asText(row.last_user_at)
  const lastAssistant = asText(row.last_assistant_at)
  if (!lastAssistant) return false
  if (!lastUser) return true
  return Date.parse(lastAssistant) > Date.parse(lastUser)
}

function shouldSkipIdle(row: IdleSessionRow) {
  if (asText(row.inactivity_closed_at)) return true
  const lastAction = asText(row.last_action)
  if (lastAction === "human_service" || lastAction === "human_sales") return true
  return false
}

async function hasPendingBuffer(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data } = await supabase
    .from("hom_agent_message_buffer")
    .select("updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (!data?.updated_at) return false
  return msSince(String(data.updated_at)) < INACTIVITY_PING_MS
}

async function loadIdleSessions(limit = 40) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_sessions")
    .select(
      "conversation_id, last_user_at, last_assistant_at, inactivity_ping_sent_at, inactivity_closed_at, customer_name, customer_phone"
    )
    .is("inactivity_closed_at", null)
    .not("last_assistant_at", "is", null)
    .order("last_assistant_at", { ascending: true })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as Omit<IdleSessionRow, "last_action">[]
  if (!rows.length) return [] as IdleSessionRow[]

  const conversationIds = rows.map((row) => row.conversation_id)
  const { data: lastMessages, error: messageError } = await supabase
    .from("hom_agent_messages")
    .select("conversation_id, action")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(conversationIds.length * 3, 40))

  if (messageError) throw messageError

  const lastActionByConversation = new Map<string, string>()
  for (const message of lastMessages ?? []) {
    const conversationId = asText(message.conversation_id)
    if (!conversationId || lastActionByConversation.has(conversationId)) continue
    lastActionByConversation.set(conversationId, asText(message.action))
  }

  return rows.map((row) => ({
    ...row,
    last_action: lastActionByConversation.get(row.conversation_id) ?? null,
  }))
}

export async function processInactivityTimeouts() {
  const sessions = await loadIdleSessions()
  const results = {
    scanned: sessions.length,
    pinged: 0,
    closed: 0,
    skipped: 0,
    errors: [] as string[],
  }

  for (const row of sessions) {
    try {
      if (shouldSkipIdle(row)) {
        results.skipped += 1
        continue
      }

      if (!botIsWaiting(row) || (await hasPendingBuffer(row.conversation_id))) {
        results.skipped += 1
        continue
      }

      const customerId = parseCustomerId(row.conversation_id)
      if (!customerId) {
        results.skipped += 1
        continue
      }

      if (!shouldReplyPhone(row.customer_phone)) {
        results.skipped += 1
        continue
      }

      const waitingMs = msSince(row.last_assistant_at)
      const pingSentAt = asText(row.inactivity_ping_sent_at)
      const sincePingMs = msSince(pingSentAt)

      if (
        pingSentAt &&
        sincePingMs >= INACTIVITY_CLOSE_AFTER_PING_MS &&
        waitingMs >= INACTIVITY_PING_MS + INACTIVITY_CLOSE_AFTER_PING_MS
      ) {
        const reply = buildInactivityCloseReply()
        await assignToApiAgent(customerId)
        await sendCustomerText(customerId, reply)
        await recordProactiveAssistantMessage({
          conversationId: row.conversation_id,
          assistantText: reply,
          action: "inactivity_close",
        })
        results.closed += 1
        continue
      }

      if (!pingSentAt && waitingMs >= INACTIVITY_PING_MS) {
        const reply = buildInactivityPingReply(row.customer_name ?? undefined)
        await assignToApiAgent(customerId)
        await sendCustomerText(customerId, reply)
        await recordProactiveAssistantMessage({
          conversationId: row.conversation_id,
          assistantText: reply,
          action: "inactivity_ping",
        })
        results.pinged += 1
        continue
      }

      results.skipped += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inactivity cron failed"
      results.errors.push(`${row.conversation_id}: ${message}`)
    }
  }

  return results
}

export async function ensureSessionMetaFromInbound(input: {
  conversationId: string
  customerName?: string
  customerPhone?: string
}) {
  await touchSessionMeta(input.conversationId, {
    customerName: input.customerName,
    customerPhone: input.customerPhone,
  })
}
