import {
  INACTIVITY_CLOSE_AFTER_PING_MS,
  INACTIVITY_PING_MS,
  buildInactivityCloseReply,
  buildInactivityPingReply,
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

function internalAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const cron = resolveCronSecret()
  const apiKey = process.env.AGENT_API_KEY?.trim()
  if (cron) headers.Authorization = `Bearer ${cron}`
  else if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

export function internalBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/^https?:\/\//, "")}`

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`

  return "http://localhost:3000"
}

async function lastMessageRole(conversationId: string) {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("role, action")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return {
    role: data?.role === "user" || data?.role === "assistant" ? data.role : null,
    action: asText(data?.action),
  }
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

async function shouldSendPing(payload: InactivityWatchPayload) {
  const watchAssistantAt = asText(payload.watchAssistantAt)
  if (!watchAssistantAt) return false

  const session = await getSessionInactivityState(payload.conversationId)
  if (!session) return false
  if (!shouldReplyPhone(resolveWatchPhone(payload, session.customer_phone))) return false
  if (asText(session.inactivity_closed_at)) return false
  if (asText(session.inactivity_ping_sent_at)) return false
  if (!sameTimestamp(asText(session.last_assistant_at), watchAssistantAt)) return false
  if (await hasPendingBuffer(payload.conversationId)) return false

  const last = await lastMessageRole(payload.conversationId)
  if (last.action === "human_service" || last.action === "human_sales") return false
  return last.role === "assistant"
}

async function shouldSendClose(payload: InactivityWatchPayload) {
  const watchPingSentAt = asText(payload.watchPingSentAt)
  if (!watchPingSentAt) return false

  const session = await getSessionInactivityState(payload.conversationId)
  if (!session) return false
  if (!shouldReplyPhone(resolveWatchPhone(payload, session.customer_phone))) return false
  if (asText(session.inactivity_closed_at)) return false
  if (!sameTimestamp(asText(session.inactivity_ping_sent_at), watchPingSentAt)) return false
  if (await hasPendingBuffer(payload.conversationId)) return false

  const last = await lastMessageRole(payload.conversationId)
  if (last.action === "human_service" || last.action === "human_sales") return false
  return last.role === "assistant"
}

async function kickInactivityWatch(payload: InactivityWatchPayload) {
  const url = `${internalBaseUrl()}/api/landbot/inactivity-watch`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: internalAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(
        "[inactivity-watch] kick failed",
        response.status,
        body.slice(0, 200)
      )
    }
  } catch (error) {
    console.error("[inactivity-watch] kick failed", error)
  }
}

export async function scheduleInactivityWatch(input: {
  conversationId: string
  customerId: number
  customerName?: string
  customerPhone?: string
  watchAssistantAt: string
}) {
  await kickInactivityWatch({
    phase: "ping",
    conversationId: input.conversationId,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    watchAssistantAt: input.watchAssistantAt,
  })
}

export async function runInactivityWatch(payload: InactivityWatchPayload) {
  if (payload.phase === "ping") {
    await sleep(INACTIVITY_PING_MS)
    if (!(await shouldSendPing(payload))) {
      return { ok: true, skipped: "ping_not_needed" as const }
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
    if (!watchPingSentAt) {
      return { ok: true, skipped: "ping_not_recorded" as const }
    }

    void kickInactivityWatch({
      phase: "close",
      conversationId: payload.conversationId,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      watchPingSentAt,
    })

    return { ok: true, sent: "ping" as const }
  }

  await sleep(INACTIVITY_CLOSE_AFTER_PING_MS)
  if (!(await shouldSendClose(payload))) {
    return { ok: true, skipped: "close_not_needed" as const }
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
