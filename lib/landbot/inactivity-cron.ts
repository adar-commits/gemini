import { shouldSkipInactivityForHumanWait } from "@/lib/agents/human-waiting"
import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
  buildInactivityCloseReply,
  buildInactivityPingReply,
  isInactivityAssistantMessage,
  shouldSuppressInactivityWatch,
} from "@/lib/agents/inactivity"
import { getSessionInactivityState, recordProactiveAssistantMessage } from "@/lib/agents/memory"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { shouldReplyPhone } from "@/lib/landbot/allowlist"
import { assignToApiAgent, sendCustomerText } from "@/lib/landbot/client"
import { scheduleInactivityCloseWatch } from "@/lib/landbot/inactivity-watcher"
import { shouldSkipInactivityClose } from "@/lib/agents/inactivity-policy"

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

type CloseCandidate = IdleSessionRow & { pingAt: string }

const IDLE_SCAN_LIMIT = 80
const CLOSE_SCAN_LIMIT = 80

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
    .select("content, created_at, action")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

async function getLastMeaningfulAssistantMessage(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("content, created_at, action")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(8)

  if (error) throw error
  for (const row of data ?? []) {
    const content = String(row.content ?? "")
    if (isInactivityAssistantMessage(content)) continue
    return row
  }
  return null
}

async function lastAssistantIsInactivityPing(conversationId: string) {
  const lastAssistant = await getLastAssistantMessage(conversationId)
  if (!lastAssistant?.content) return null
  if (!isInactivityAssistantMessage(String(lastAssistant.content))) return null
  return String(lastAssistant.created_at)
}

async function userRepliedAfterTimestamp(conversationId: string, sinceIso: string) {
  const sinceMs = Date.parse(sinceIso)
  if (!Number.isFinite(sinceMs)) return false

  const session = await getSessionInactivityState(conversationId)
  const lastUserAt = asText(session?.last_user_at)
  if (lastUserAt && Date.parse(lastUserAt) >= sinceMs - 1000) return true

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .gt("created_at", new Date(sinceMs - 1000).toISOString())
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.created_at)
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

async function shouldSkipIdleForHumanWait(row: IdleSessionRow) {
  if (shouldSkipIdle(row)) return true
  const meaningful = await getLastMeaningfulAssistantMessage(row.conversation_id)
  return shouldSkipInactivityForHumanWait({
    lastAction: asText(row.last_action) || asText(meaningful?.action),
    lastAssistantText: meaningful?.content ? String(meaningful.content) : null,
  })
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

async function hydrateSessionRows(
  rows: Array<Omit<IdleSessionRow, "last_action">>
): Promise<IdleSessionRow[]> {
  if (!rows.length) return []

  const supabase = getAgentSupabase()
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

async function loadIdleSessions(limit = IDLE_SCAN_LIMIT) {
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
  return hydrateSessionRows((data ?? []) as Omit<IdleSessionRow, "last_action">[])
}

/** Sessions past the post-ping close deadline — scanned first so recent pings are not starved. */
async function loadSessionsDueForClose(limit = CLOSE_SCAN_LIMIT): Promise<CloseCandidate[]> {
  const supabase = getAgentSupabase()
  const cutoff = new Date(Date.now() - INACTIVITY_CLOSE_AFTER_PING_MS).toISOString()
  const pingAtByConversation = new Map<string, string>()

  const { data: fromSessions, error: sessionError } = await supabase
    .from("hom_agent_sessions")
    .select(
      "conversation_id, last_user_at, last_assistant_at, inactivity_ping_sent_at, inactivity_closed_at, customer_name, customer_phone"
    )
    .is("inactivity_closed_at", null)
    .not("inactivity_ping_sent_at", "is", null)
    .lt("inactivity_ping_sent_at", cutoff)
    .limit(limit)

  if (sessionError) throw sessionError

  for (const row of fromSessions ?? []) {
    const conversationId = asText(row.conversation_id)
    const pingAt = asText(row.inactivity_ping_sent_at)
    if (conversationId && pingAt) pingAtByConversation.set(conversationId, pingAt)
  }

  const { data: pingMessages, error: messageError } = await supabase
    .from("hom_agent_messages")
    .select("conversation_id, created_at, content")
    .eq("role", "assistant")
    .eq("action", "inactivity_ping")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit * 3)

  if (messageError) throw messageError

  for (const message of pingMessages ?? []) {
    const conversationId = asText(message.conversation_id)
    const createdAt = asText(message.created_at)
    if (!conversationId || !createdAt) continue
    if (!isInactivityAssistantMessage(String(message.content ?? ""))) continue
    if (!pingAtByConversation.has(conversationId)) {
      pingAtByConversation.set(conversationId, createdAt)
    }
  }

  if (!pingAtByConversation.size) return []

  const conversationIds = [...pingAtByConversation.keys()]
  const { data: sessions, error: hydrateError } = await supabase
    .from("hom_agent_sessions")
    .select(
      "conversation_id, last_user_at, last_assistant_at, inactivity_ping_sent_at, inactivity_closed_at, customer_name, customer_phone"
    )
    .in("conversation_id", conversationIds)
    .is("inactivity_closed_at", null)

  if (hydrateError) throw hydrateError

  const hydrated = await hydrateSessionRows(
    (sessions ?? []) as Omit<IdleSessionRow, "last_action">[]
  )

  const due: CloseCandidate[] = []
  for (const row of hydrated) {
    const pingAt =
      (await lastAssistantIsInactivityPing(row.conversation_id)) ??
      pingAtByConversation.get(row.conversation_id) ??
      asText(row.inactivity_ping_sent_at)
    if (!pingAt) continue
    if (msSince(pingAt) < INACTIVITY_CLOSE_AFTER_PING_MS) continue
    due.push({ ...row, pingAt })
  }

  return due
}

async function attemptInactivityClose(row: CloseCandidate) {
  if (await shouldSkipIdleForHumanWait(row)) return "skipped" as const
  if (await hasPendingBuffer(row.conversation_id)) return "skipped" as const
  if (!(await isBotWaitingForUser(row))) return "skipped" as const

  const customerId = parseCustomerId(row.conversation_id)
  if (!customerId) return "skipped" as const
  if (!shouldReplyPhone(row.customer_phone)) return "skipped" as const

  const { getConversationContext } = await import("@/lib/agents/memory")
  const context = await getConversationContext(row.conversation_id)
  if (shouldSkipInactivityClose(context.history, context.lastAgent)) {
    return "skipped" as const
  }

  const pingAt = await lastAssistantIsInactivityPing(row.conversation_id)
  if (!pingAt) return "skipped" as const
  if (await userRepliedAfterTimestamp(row.conversation_id, pingAt)) {
    return "skipped" as const
  }
  if (msSince(pingAt) < INACTIVITY_CLOSE_AFTER_PING_MS) return "skipped" as const

  const reply = buildInactivityCloseReply()
  await assignToApiAgent(customerId)
  await sendCustomerText(customerId, reply)
  await recordProactiveAssistantMessage({
    conversationId: row.conversation_id,
    assistantText: reply,
    action: "inactivity_close",
  })
  return "closed" as const
}

export async function processInactivityTimeouts() {
  const backfilled = await backfillSessionActivityTimestamps()
  const dueForClose = await loadSessionsDueForClose()
  const sessions = await loadIdleSessions()
  const results = {
    backfilled,
    closeCandidates: dueForClose.length,
    scanned: sessions.length,
    pinged: 0,
    closed: 0,
    skipped: 0,
    errors: [] as string[],
  }

  for (const row of dueForClose) {
    try {
      const outcome = await attemptInactivityClose(row)
      if (outcome === "closed") results.closed += 1
      else results.skipped += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inactivity close failed"
      results.errors.push(`${row.conversation_id}: ${message}`)
    }
  }

  for (const row of sessions) {
    try {
      if (await shouldSkipIdleForHumanWait(row)) {
        results.skipped += 1
        continue
      }

      const { getConversationContext } = await import("@/lib/agents/memory")
      const context = await getConversationContext(row.conversation_id)
      if (shouldSuppressInactivityWatch(context.history)) {
        results.skipped += 1
        continue
      }

      const skipCloseForSales = shouldSkipInactivityClose(
        context.history,
        context.lastAgent
      )

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
      const lastUserAt = asText(row.last_user_at)

      const inactivityPingAt = await lastAssistantIsInactivityPing(row.conversation_id)
      if (inactivityPingAt) {
        results.skipped += 1
        continue
      }

      const userRepliedAfterPing =
        Boolean(pingSentAt) &&
        Boolean(lastUserAt) &&
        Date.parse(lastUserAt) >= Date.parse(pingSentAt) - 1000

      if (
        pingSentAt &&
        msSince(pingSentAt) >= INACTIVITY_CLOSE_AFTER_PING_MS &&
        !userRepliedAfterPing
      ) {
        const outcome = await attemptInactivityClose({ ...row, pingAt: pingSentAt })
        if (outcome === "closed") {
          results.closed += 1
          continue
        }
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
        if (watchPingSentAt && !skipCloseForSales) {
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
