import { getRuntimeConfig } from "@/lib/agent-core/runtime-config"
import { getConversationContext } from "@/lib/agents/memory"
import { isExtendedOpeningDebounce } from "@/lib/agents/greeting"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { mergeTurns, type UserTurn } from "@/lib/agents/user-turn"

const DEFAULT_DEBOUNCE_MS = 8000
const DEFAULT_FIRST_TURN_DEBOUNCE_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function configuredDebounceMs() {
  const env = Number(process.env.LANDBOT_DEBOUNCE_MS ?? "")
  if (Number.isFinite(env) && env > 0) return env
  return null
}

function configuredFirstTurnDebounceMs() {
  const env = Number(process.env.LANDBOT_FIRST_TURN_DEBOUNCE_MS ?? "")
  if (Number.isFinite(env) && env > 0) return env
  return DEFAULT_FIRST_TURN_DEBOUNCE_MS
}

async function baseDebounceMs() {
  const envOverride = configuredDebounceMs()
  if (envOverride) return envOverride

  try {
    const runtime = await getRuntimeConfig()
    return runtime.debounceMs
  } catch {
    return DEFAULT_DEBOUNCE_MS
  }
}

/** Opening customer turn waits longer so rapid first messages merge before routing. */
export async function debounceWindowMs(conversationId?: string) {
  if (conversationId) {
    try {
      const context = await getConversationContext(conversationId)
      if (isExtendedOpeningDebounce(context)) {
        return configuredFirstTurnDebounceMs()
      }
    } catch {
      // fall through to default debounce
    }
  }

  return baseDebounceMs()
}

type BufferSnapshot = {
  parts: UserTurn[]
  updatedAt: string
}

async function readBufferSnapshot(conversationId: string): Promise<BufferSnapshot | null> {
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (error) throw error
  if (!data?.parts || !Array.isArray(data.parts) || data.parts.length === 0) {
    return null
  }

  return {
    parts: data.parts as UserTurn[],
    updatedAt: String(data.updated_at),
  }
}

export async function hasBufferedCustomerMessages(conversationId: string) {
  return (await readBufferSnapshot(conversationId)) != null
}

export async function enqueueCustomerTurn(conversationId: string, turn: UserTurn) {
  const supabase = getAgentSupabase()
  const { data: existing } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  const parts = Array.isArray(existing?.parts) ? [...existing.parts, turn] : [turn]
  const updatedAt = new Date().toISOString()

  const { error } = await supabase.from("hom_agent_message_buffer").upsert({
    conversation_id: conversationId,
    parts,
    updated_at: updatedAt,
  })
  if (error) throw error
  return updatedAt
}

/** Wait until the buffer has been quiet for debounceWindowMs since the last customer message. */
export async function waitUntilBufferQuiet(conversationId: string) {
  const window = await debounceWindowMs(conversationId)
  const pollMs = 250
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const snapshot = await readBufferSnapshot(conversationId)
    if (!snapshot) return

    const quietMs = Date.now() - new Date(snapshot.updatedAt).getTime()
    if (quietMs >= window) return

    await sleep(Math.min(pollMs, Math.max(50, window - quietMs)))
  }
}

/** Atomically claim buffered parts after a quiet window. */
export async function claimBufferedTurn(conversationId: string): Promise<UserTurn | null> {
  const window = await debounceWindowMs(conversationId)
  const snapshot = await readBufferSnapshot(conversationId)
  if (!snapshot) return null

  const quietMs = Date.now() - new Date(snapshot.updatedAt).getTime()
  if (quietMs < window) return null

  const supabase = getAgentSupabase()
  const { data: claimed, error: claimError } = await supabase
    .from("hom_agent_message_buffer")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("updated_at", snapshot.updatedAt)
    .select("parts")
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed?.parts || !Array.isArray(claimed.parts)) return null

  return mergeTurns(claimed.parts as UserTurn[])
}

/**
 * Wait for quiet, claim, then absorb any trailing burst before the handler runs.
 * Resets the quiet timer whenever a new customer line lands in the buffer.
 */
export async function absorbBufferedTurn(conversationId: string): Promise<UserTurn | null> {
  while (true) {
    await waitUntilBufferQuiet(conversationId)

    const before = await readBufferSnapshot(conversationId)
    if (!before) return null

    let turn = await claimBufferedTurn(conversationId)
    if (!turn) return null

    while (true) {
      await waitUntilBufferQuiet(conversationId)
      const extra = await claimBufferedTurn(conversationId)
      if (!extra) break
      turn = mergeTurns([turn, extra])
    }

    const after = await readBufferSnapshot(conversationId)
    if (after) continue

    return turn
  }
}

/**
 * If the customer sent more lines while the agent was thinking, merge before outbound send.
 */
export async function coalesceTrailingBufferedTurn(
  conversationId: string,
  turn: UserTurn
): Promise<UserTurn> {
  if (!(await hasBufferedCustomerMessages(conversationId))) return turn

  await waitUntilBufferQuiet(conversationId)
  const extra = await claimBufferedTurn(conversationId)
  if (!extra) return turn

  return mergeTurns([turn, extra])
}

/** @deprecated Use waitUntilBufferQuiet + claimBufferedTurn */
export async function waitAndTakeBufferedTurn(
  conversationId: string,
  options?: { quietAccumulatesAfterMs?: number }
): Promise<UserTurn | null> {
  void options
  await waitUntilBufferQuiet(conversationId)
  return claimBufferedTurn(conversationId)
}

/**
 * One active drainer per conversation: absorb bursts, handle, coalesce trailing lines before send.
 */
export async function drainConversationBuffer(input: {
  conversationId: string
  handler: (turn: UserTurn) => Promise<void>
}) {
  while (true) {
    const turn = await absorbBufferedTurn(input.conversationId)
    if (!turn) break
    await input.handler(turn)
  }
}
