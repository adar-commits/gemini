import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
  buildInactivityCloseReply,
  buildInactivityPingReply,
  isInactivityAssistantMessage,
} from "@/lib/agents/inactivity"
import { resolveCronSecret } from "@/lib/agents/cron-auth"
import {
  getSessionInactivityState,
  recordProactiveAssistantMessage,
  touchSessionMeta,
} from "@/lib/agents/memory"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { shouldReplyPhone } from "@/lib/landbot/allowlist"
import { assignToApiAgent, sendCustomerText } from "@/lib/landbot/client"
import { inactivityWatchUrl } from "@/lib/landbot/sync-hook"

/** Chunk close waits so serverless (maxDuration ~300s) can chain to 15+ min. */
const CLOSE_WATCH_CHUNK_MS = 240_000

export type InactivityWatchPhase = "ping" | "close"

export type InactivityWatchPayload = {
  phase: InactivityWatchPhase
  conversationId: string
  customerId: number
  customerName?: string
  customerPhone?: string
  watchAssistantAt?: string
  watchPingSentAt?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function sameTimestamp(a: string, b: string) {
  const left = Date.parse(a)
  const right = Date.parse(b)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return a === b
  return Math.abs(left - right) < 5
}

function botIsWaiting(session: {
  last_user_at?: unknown
  last_assistant_at?: unknown
}) {
  const lastUser = asText(session.last_user_at)
  const lastAssistant = asText(session.last_assistant_at)
  if (!lastAssistant) return false
  if (!lastUser) return true
  return Date.parse(lastAssistant) >= Date.parse(lastUser)
}

async function lastMessageAction(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("action")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return asText(data?.action)
}

async function hasPendingBuffer(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data } = await supabase
    .from("hom_agent_message_buffer")
    .select("updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (!data?.updated_at) return false
  return Date.now() - Date.parse(String(data.updated_at)) < INACTIVITY_PING_MS
}

function resolveWatchPhone(payload: InactivityWatchPayload, sessionPhone?: unknown) {
  return asText(payload.customerPhone) || asText(sessionPhone) || undefined
}

async function lastAssistantIsInactivityPing(conversationId: string) {
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
  if (!data?.content || !isInactivityAssistantMessage(String(data.content))) return null
  return String(data.created_at)
}

async function resolveInactivityPingTimestamp(conversationId: string, fallback?: string) {
  const fromMessage = await lastAssistantIsInactivityPing(conversationId)
  if (fromMessage) return fromMessage
  const session = await getSessionInactivityState(conversationId)
  return asText(session?.inactivity_ping_sent_at) || asText(fallback) || null
}

async function shouldSendPing(payload: InactivityWatchPayload) {
  const watchAssistantAt = asText(payload.watchAssistantAt)
  if (!watchAssistantAt) return "missing_watch_assistant_at" as const

  const session = await getSessionInactivityState(payload.conversationId)
  if (!session) return "missing_session" as const
  if (!shouldReplyPhone(resolveWatchPhone(payload, session.customer_phone))) {
    return "phone_not_allowed" as const
  }
  if (asText(session.inactivity_closed_at)) return "already_closed" as const
  if (await lastAssistantIsInactivityPing(payload.conversationId)) {
    return "ping_already_sent" as const
  }
  if (asText(session.inactivity_ping_sent_at)) return "ping_already_sent" as const
  if (!sameTimestamp(asText(session.last_assistant_at), watchAssistantAt)) {
    return "assistant_timestamp_changed" as const
  }
  if (!botIsWaiting(session)) return "bot_not_waiting" as const
  if (await hasPendingBuffer(payload.conversationId)) return "pending_buffer" as const

  const action = await lastMessageAction(payload.conversationId)
  if (action === "human_service" || action === "human_sales") {
    return "human_handoff" as const
  }
  return null
}

async function userRepliedAfterPing(
  conversationId: string,
  watchPingSentAt: string
) {
  const pingMs = Date.parse(watchPingSentAt)
  if (!Number.isFinite(pingMs)) return false

  const session = await getSessionInactivityState(conversationId)
  const lastUserAt = asText(session?.last_user_at)
  if (lastUserAt && Date.parse(lastUserAt) >= pingMs - 1000) return true

  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .gt("created_at", new Date(pingMs - 1000).toISOString())
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.created_at)
}

async function shouldSendClose(payload: InactivityWatchPayload) {
  const watchPingSentAt =
    (await resolveInactivityPingTimestamp(
      payload.conversationId,
      payload.watchPingSentAt
    )) ?? null
  if (!watchPingSentAt) return "missing_watch_ping_sent_at" as const

  if (await userRepliedAfterPing(payload.conversationId, watchPingSentAt)) {
    return "user_replied_after_ping" as const
  }

  if (Date.now() - Date.parse(watchPingSentAt) < INACTIVITY_CLOSE_AFTER_PING_MS) {
    return "not_due_yet" as const
  }

  const session = await getSessionInactivityState(payload.conversationId)
  if (!session) return "missing_session" as const
  if (!shouldReplyPhone(resolveWatchPhone(payload, session.customer_phone))) {
    return "phone_not_allowed" as const
  }
  if (asText(session.inactivity_closed_at)) return "already_closed" as const
  if (!(await lastAssistantIsInactivityPing(payload.conversationId))) {
    return "ping_not_last_assistant" as const
  }
  if (!botIsWaiting(session)) return "bot_not_waiting" as const
  if (await hasPendingBuffer(payload.conversationId)) return "pending_buffer" as const

  const action = await lastMessageAction(payload.conversationId)
  if (action === "human_service" || action === "human_sales") {
    return "human_handoff" as const
  }
  return null
}

export async function scheduleInactivityCloseWatch(payload: {
  conversationId: string
  customerId: number
  customerName?: string
  customerPhone?: string
  watchPingSentAt: string
}) {
  const secret = resolveCronSecret()
  const url = inactivityWatchUrl()
  if (!secret) {
    console.warn(
      "[inactivity-watch] close schedule skipped — set CRON_SECRET for chained close"
    )
    return false
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        phase: "close",
        conversationId: payload.conversationId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        watchPingSentAt: payload.watchPingSentAt,
      }),
    })
    if (!response.ok) {
      console.warn(
        "[inactivity-watch] close schedule failed",
        payload.conversationId,
        response.status
      )
      return false
    }
    return true
  } catch (error) {
    console.warn("[inactivity-watch] close schedule error", payload.conversationId, error)
    return false
  }
}

async function runClosePhase(payload: InactivityWatchPayload) {
  const watchPingSentAt =
    (await resolveInactivityPingTimestamp(
      payload.conversationId,
      payload.watchPingSentAt
    )) ?? ""
  if (!watchPingSentAt) {
    return { ok: true, skipped: "missing_watch_ping_sent_at" as const }
  }

  const dueAt = Date.parse(watchPingSentAt) + INACTIVITY_CLOSE_AFTER_PING_MS
  const remaining = dueAt - Date.now()

  if (remaining > CLOSE_WATCH_CHUNK_MS) {
    await sleep(CLOSE_WATCH_CHUNK_MS)
    await scheduleInactivityCloseWatch({
      conversationId: payload.conversationId,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      watchPingSentAt,
    })
    return { ok: true, rescheduled: true as const }
  }

  if (remaining > 0) {
    await sleep(remaining)
  }

  const skip = await shouldSendClose({ ...payload, watchPingSentAt })
  if (skip) {
    if (skip === "not_due_yet") {
      await scheduleInactivityCloseWatch({
        conversationId: payload.conversationId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        watchPingSentAt,
      })
      return { ok: true, rescheduled: true as const }
    }
    console.log("[inactivity-watch] close skipped", payload.conversationId, skip)
    return { ok: true, skipped: skip }
  }

  const reply = buildInactivityCloseReply()
  await assignToApiAgent(payload.customerId)
  await sendCustomerText(payload.customerId, reply)
  await recordProactiveAssistantMessage({
    conversationId: payload.conversationId,
    assistantText: reply,
    action: "inactivity_close",
  })

  return { ok: true, sent: "close" as const }
}

export async function runInactivityWatch(payload: InactivityWatchPayload) {
  if (payload.phase === "ping") {
    await sleep(INACTIVITY_PING_MS)
    const skip = await shouldSendPing(payload)
    if (skip) {
      console.log("[inactivity-watch] ping skipped", payload.conversationId, skip)
      return { ok: true, skipped: skip }
    }

    const reply = buildInactivityPingReply(payload.customerName)
    await assignToApiAgent(payload.customerId)
    await sendCustomerText(payload.customerId, reply)
    await recordProactiveAssistantMessage({
      conversationId: payload.conversationId,
      assistantText: reply,
      action: "inactivity_ping",
    })

    const session = await getSessionInactivityState(payload.conversationId)
    const watchPingSentAt = asText(session?.inactivity_ping_sent_at)
    if (watchPingSentAt) {
      void scheduleInactivityCloseWatch({
        conversationId: payload.conversationId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        watchPingSentAt,
      })
    }

    return { ok: true, sent: "ping" as const }
  }

  return runClosePhase(payload)
}

/** Ping after INACTIVITY_PING_MS; close chains via scheduleInactivityCloseWatch (+ cron backup). */
export async function runInactivityPipeline(input: {
  conversationId: string
  customerId: number
  customerName?: string
  customerPhone?: string
  watchAssistantAt: string
}) {
  return runInactivityWatch({
    phase: "ping",
    conversationId: input.conversationId,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    watchAssistantAt: input.watchAssistantAt,
  })
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
