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
}

/** v3 main agent — Sonnet by default, Opus on hard-case signals. */
export function pickHomAgentModel(input: {
  body: string
  turn: UserTurn
  history: HistoryMessage[]
  defaultModel: string
}): HomAgentModelPick {
  const decision = pickModelTier({
    body: input.body,
    turn: input.turn,
    history: input.history,
    specialist: "faq",
    orchestraMode: "conservative",
  })

  if (decision.tier === "T3") {
    const opus = homAgentHardCaseModel()
    return {
      tier: "T3",
      reason: decision.reason,
      model: opus,
      escalated: opus !== input.defaultModel,
    }
  }

  return {
    tier: decision.tier === "T1" ? "T2" : decision.tier,
    reason: decision.reason,
    model: input.defaultModel,
    escalated: false,
  }
}
