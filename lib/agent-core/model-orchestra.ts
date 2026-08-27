import type { SpecialistKind } from "@/lib/agent-core/config"
import type { ModelProfile } from "@/lib/agent-core/model-profiles"
import { MODEL_PROFILES } from "@/lib/agent-core/model-profiles"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { hasImmediateBusinessAsk } from "@/lib/agents/greeting"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"

export type OrchestraMode = "off" | "conservative" | "aggressive"
export type ModelTier = "T0" | "T1" | "T2" | "T3"

export type OrchestraDecision = {
  tier: ModelTier
  reason: string
  useFullKb: boolean
  skipMaster: boolean
}

const OPUS = MODEL_PROFILES.quality.faq.model
const SONNET = MODEL_PROFILES.balanced.faq.model

function hasPolicyDispute(text: string, history: HistoryMessage[]) {
  const combined = `${text}\n${history.slice(-4).map((m) => m.content).join("\n")}`
  return /ממציא|שקר|לא\s+נכון|זה\s+לא\s+מה\s+ש|אמרת\s+קודם|לא\s+מקבל/i.test(combined)
}

function isComplexService(text: string) {
  return /פגום|קרוע|כתם|לא\s+קיבלתי|חסר|שגוי|החזר\s+כספי|ביטול\s+הזמנה|חשבונית|קבלה/i.test(
    text
  )
}

export function pickModelTier(input: {
  body: string
  turn: UserTurn
  history: HistoryMessage[]
  specialist: SpecialistKind
  orchestraMode: OrchestraMode
}): OrchestraDecision {
  const { body, turn, history, specialist, orchestraMode } = input

  if (orchestraMode === "off") {
    return {
      tier: "T2",
      reason: "orchestra_off",
      useFullKb: false,
      skipMaster: false,
    }
  }

  if (isDissatisfactionWithoutDefect(body) || hasPolicyDispute(body, history)) {
    return {
      tier: "T3",
      reason: "dissatisfaction_or_policy_dispute",
      useFullKb: true,
      skipMaster: true,
    }
  }

  if (turn.media.some((m) => m.kind === "image") && specialist === "service") {
    return {
      tier: "T3",
      reason: "service_with_image",
      useFullKb: false,
      skipMaster: true,
    }
  }

  if (isHumanHandoffPending(history) || isComplexService(body)) {
    return {
      tier: orchestraMode === "aggressive" ? "T2" : "T3",
      reason: "service_complexity",
      useFullKb: false,
      skipMaster: true,
    }
  }

  if (hasImmediateBusinessAsk(body) && body.split(/\s+/).length <= 12) {
    return {
      tier: "T2",
      reason: "clear_business_ask",
      useFullKb: false,
      skipMaster: true,
    }
  }

  if (body.split(/\s+/).length >= 20 || / וגם | ואז | בנוסף /i.test(body)) {
    return {
      tier: "T3",
      reason: "multi_intent_long",
      useFullKb: true,
      skipMaster: false,
    }
  }

  return {
    tier: orchestraMode === "aggressive" ? "T1" : "T2",
    reason: "default",
    useFullKb: false,
    skipMaster: hasImmediateBusinessAsk(body),
  }
}

export function modelForTier(
  profile: ModelProfile,
  specialist: SpecialistKind,
  tier: ModelTier
): string {
  const roleConfig = profile[specialist]
  if (tier === "T3") return OPUS
  if (tier === "T1") return MODEL_PROFILES.economy.faq.model
  if (tier === "T2") return roleConfig.model.includes("opus") ? SONNET : roleConfig.model
  return roleConfig.model
}

export function routerModelForTier(profile: ModelProfile, tier: ModelTier): string {
  if (tier === "T3") return MODEL_PROFILES.quality.router.model
  if (tier === "T1") return MODEL_PROFILES.economy.router.model
  return profile.router.model
}
