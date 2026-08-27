import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
  buildInactivityCloseReply,
  buildInactivityPingReply,
  isInactivityAssistantMessage,
} from "@/lib/agents/inactivity"
import { getSessionInactivityState, recordProactiveAssistantMessage } from "@/lib/agents/memory"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { shouldReplyPhone } from "@/lib/landbot/allowlist"
import { assignToApiAgent, sendCustomerText } from "@/lib/landbot/client"
import { scheduleInactivityCloseWatch } from "@/lib/landbot/inactivity-watcher"

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
  return Date.parse(lastAssistant) >= Date.parse(lastUser)
}

async function lastMessageRole(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("role")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (data?.role === "user" || data?.role === "assistant") return data.role
  return null
}

async function getLastAssistantMessage(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("content, created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

async function lastAssistantIsInactivityPing(conversationId: string) {
  const lastAssistant = await getLastAssistantMessage(conversationId)
  if (!lastAssistant?.content) return null
  if (!isInactivityAssistantMessage(String(lastAssistant.content))) return null
  return String(lastAssistant.created_at)
}

async function isBotWaitingForUser(row: IdleSessionRow) {
  const role = await lastMessageRole(row.conversation_id)
  if (role === "assistant") return true
  if (role === "user") return false
  return botIsWaiting(row)
}

async function backfillSessionActivityTimestamps(limit = 50) {
  const supabase = getAgentSupabase()
  const { data: sessions, error } = await supabase
    .from("hom_agent_sessions")
    .select("conversation_id")
    .or("last_assistant_at.is.null,last_user_at.is.null")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!sessions?.length) return 0

  let updated = 0
  for (const session of sessions) {
    const conversationId = asText(session.conversation_id)
    if (!conversationId) continue

    const [{ data: lastUser }, { data: lastAssistant }] = await Promise.all([
      supabase
        .from("hom_agent_messages")
        .select("created_at")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("hom_agent_messages")
        .select("created_at")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!lastUser?.created_at && !lastAssistant?.created_at) continue

    const assistantAt = lastAssistant?.created_at
      ? new Date(String(lastAssistant.created_at)).toISOString()
      : null
    const userAt = lastUser?.created_at
      ? new Date(String(lastUser.created_at)).toISOString()
      : null
    const normalizedAssistantAt =
      assistantAt && userAt && assistantAt === userAt
        ? new Date(Date.parse(assistantAt) + 1).toISOString()
        : assistantAt

    const { error: updateError } = await supabase
      .from("hom_agent_sessions")
      .update({
        last_user_at: userAt,
        last_assistant_at: normalizedAssistantAt,
        updated_at: new Date().toISOString(),
      })
      .eq("conversation_id", conversationId)

    if (!updateError) updated += 1
  }

  return updated
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
  const backfilled = await backfillSessionActivityTimestamps()
  const sessions = await loadIdleSessions()
  const results = {
    backfilled,
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

      if (!(await isBotWaitingForUser(row)) || (await hasPendingBuffer(row.conversation_id))) {
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
      const lastUserAt = asText(row.last_user_at)
      const userRepliedAfterPing =
        Boolean(pingSentAt) &&
        Boolean(lastUserAt) &&
        Date.parse(lastUserAt) >= Date.parse(pingSentAt) - 1000

      const inactivityPingAt = await lastAssistantIsInactivityPing(row.conversation_id)
      if (inactivityPingAt) {
        const sinceInactivityPingMs = msSince(inactivityPingAt)
        const userRepliedAfterInactivityPing =
          Boolean(lastUserAt) &&
          Date.parse(lastUserAt) >= Date.parse(inactivityPingAt) - 1000

        if (
          sinceInactivityPingMs >= INACTIVITY_CLOSE_AFTER_PING_MS &&
          !userRepliedAfterInactivityPing
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

        results.skipped += 1
        continue
      }

      if (
        pingSentAt &&
        sincePingMs >= INACTIVITY_CLOSE_AFTER_PING_MS &&
        !userRepliedAfterPing
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
        const pingSession = await getSessionInactivityState(row.conversation_id)
        const watchPingSentAt = asText(pingSession?.inactivity_ping_sent_at)
        if (watchPingSentAt) {
          void scheduleInactivityCloseWatch({
            conversationId: row.conversation_id,
            customerId,
            customerName: row.customer_name ?? undefined,
            customerPhone: row.customer_phone ?? undefined,
            watchPingSentAt,
          })
        }
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
