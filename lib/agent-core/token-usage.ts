import { getBoundOrchestraDecision, getBoundRuntime } from "@/lib/agent-core/config"
import { recordLlmCall, recordTurnTokens, getRoutingPath, getTurnPhone } from "@/lib/agent-core/turn-metrics"
import { getAgentSupabase } from "@/lib/agents/supabase"
import type { AgentId } from "@/lib/agents/types"
import type { ModelTier } from "@/lib/agent-core/model-orchestra"

export type TokenPurpose =
  | "master"
  | "faq"
  | "sales"
  | "service"
  | "split"
  | "summary"
  | "retry"

type LanguageModelUsage = {
  inputTokens?: number
  outputTokens?: number
  promptTokens?: number
  completionTokens?: number
}

export function extractTokenCounts(usage: LanguageModelUsage | undefined | null) {
  if (!usage) return { inputTokens: 0, outputTokens: 0 }
  return {
    inputTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
    outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
  }
}

export function recordTokenUsage(input: {
  conversationId: string
  phone?: string | null
  purpose: TokenPurpose
  agent?: AgentId | null
  model: string
  usage?: LanguageModelUsage | null
  tier?: ModelTier | null
  routingPath?: string | null
  profile?: string | null
}) {
  const { inputTokens, outputTokens } = extractTokenCounts(input.usage ?? undefined)
  recordLlmCall(input.conversationId, input.model)
  recordTurnTokens(input.conversationId, inputTokens, outputTokens)

  const orchestra = getBoundOrchestraDecision()
  const runtime = getBoundRuntime()
  const tier = input.tier ?? orchestra?.tier ?? null
  const profile = input.profile ?? runtime?.activeProfile ?? null
  const routingPath = input.routingPath ?? getRoutingPath(input.conversationId)
  const phone = input.phone ?? getTurnPhone(input.conversationId)

  void (async () => {
    try {
      const supabase = getAgentSupabase()
      await supabase.from("hom_agent_token_usage").insert({
        conversation_id: input.conversationId,
        phone: phone?.trim() || null,
        purpose: input.purpose,
        agent: input.agent ?? null,
        model: input.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tier,
        routing_path: routingPath,
        profile,
      })
    } catch {
      // non-blocking
    }
  })()
}
