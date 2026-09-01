import { getRuntimeConfig } from "@/lib/agent-core/runtime-config"
import { getConversationContext } from "@/lib/agents/memory"
import { isExtendedOpeningDebounce } from "@/lib/agents/greeting"
import { getAgentSupabase } from "@/lib/agents/supabase"
import { mergeTurns, type UserTurn } from "@/lib/agents/user-turn"

const DEFAULT_DEBOUNCE_MS = 5000
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
export async function waitAndTakeBufferedTurn(
  conversationId: string,
  options?: { quietAccumulatesAfterMs?: number }
): Promise<UserTurn | null> {
  const window = await debounceWindowMs(conversationId)
  const quietFloor = options?.quietAccumulatesAfterMs ?? 0
  const pollMs = 250
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const supabase = getAgentSupabase()
    const { data, error } = await supabase
      .from("hom_agent_message_buffer")
      .select("updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle()

    if (error) throw error
    if (!data?.updated_at) return null

    const quietMs =
      Date.now() -
      Math.max(new Date(String(data.updated_at)).getTime(), quietFloor)
    if (quietMs >= window) break

    await sleep(Math.min(pollMs, Math.max(50, window - quietMs)))
  }

  const supabase = getAgentSupabase()
  const { data: snapshot, error: readError } = await supabase
    .from("hom_agent_message_buffer")
    .select("parts, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle()

  if (readError) throw readError
  if (!snapshot?.parts || !Array.isArray(snapshot.parts) || snapshot.parts.length === 0) {
    return null
  }

  const quietMs =
    Date.now() -
    Math.max(new Date(String(snapshot.updated_at)).getTime(), quietFloor)
  if (quietMs < window) return null

  const { data: claimed, error: claimError } = await supabase
    .from("hom_agent_message_buffer")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("updated_at", snapshot.updated_at)
    .select("parts")
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed?.parts || !Array.isArray(claimed.parts)) return null

  return mergeTurns(claimed.parts as UserTurn[])
}

/**
 * Wait for quiet window after the last customer message, then run handler.
 * Repeats if new messages arrived during processing (same processor lease).
 */
export async function drainConversationBuffer(input: {
  conversationId: string
  handler: (turn: UserTurn) => Promise<void>
}) {
  let quietAccumulatesAfterMs = 0

  while (true) {
    const turn = await waitAndTakeBufferedTurn(input.conversationId, {
      quietAccumulatesAfterMs,
    })
    if (!turn) break
    await input.handler(turn)
    quietAccumulatesAfterMs = Date.now()
  }
}
