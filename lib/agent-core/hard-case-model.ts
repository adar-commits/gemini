import {
  pickModelTier,
  type ModelTier,
} from "@/lib/agent-core/model-orchestra"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"

export function homAgentHardCaseModel() {
  return process.env.HOM_AGENT_HARD_CASE_MODEL?.trim() || "anthropic/claude-opus-5"
}

export type HomAgentModelPick = {
  tier: ModelTier
  reason: string
  model: string
  escalated: boolean
  /** Set when this turn should record Opus escalation on the session. */
  recordOpusEscalation?: boolean
  /** Clear session Opus flag (new hard-case episode). */
  clearOpusEscalation?: boolean
}

const OPUS_ONCE_REASONS = new Set([
  "dissatisfaction_or_policy_dispute",
  "service_with_image",
  "post_purchase_alt_size",
  "multi_intent_long",
  "service_complexity",
])

function isFreshHardCaseTrigger(reason: string, priorReason: string | null) {
  if (!priorReason) return true
  if (reason !== priorReason) return true
  return false
}

/** v3 main agent — Sonnet by default, Opus on hard-case signals (once per episode). */
export function pickHomAgentModel(input: {
  body: string
  turn: UserTurn
  history: HistoryMessage[]
  defaultModel: string
  opusEscalatedReason?: string | null
}): HomAgentModelPick {
  const decision = pickModelTier({
    body: input.body,
    turn: input.turn,
    history: input.history,
    specialist: "faq",
    orchestraMode: "conservative",
  })

  if (decision.tier !== "T3") {
    return {
      tier: decision.tier === "T1" ? "T2" : decision.tier,
      reason: decision.reason,
      model: input.defaultModel,
      escalated: false,
      clearOpusEscalation: Boolean(input.opusEscalatedReason),
    }
  }

  const prior = input.opusEscalatedReason ?? null
  const fresh = isFreshHardCaseTrigger(decision.reason, prior)

  if (!fresh && OPUS_ONCE_REASONS.has(decision.reason)) {
    return {
      tier: "T2",
      reason: `${decision.reason}_opus_followup`,
      model: input.defaultModel,
      escalated: false,
    }
  }

  const opus = homAgentHardCaseModel()
  return {
    tier: "T3",
    reason: decision.reason,
    model: opus,
    escalated: opus !== input.defaultModel,
    recordOpusEscalation: OPUS_ONCE_REASONS.has(decision.reason),
    clearOpusEscalation: fresh && !OPUS_ONCE_REASONS.has(decision.reason),
  }
}
