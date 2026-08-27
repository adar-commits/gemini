/** Model & inference settings — loaded from runtime config (Supabase) per turn. */

import {
  DEFAULT_PROFILE_NAME,
  MODEL_PROFILES,
  type ModelProfile,
} from "@/lib/agent-core/model-profiles"
import {
  getRuntimeConfig,
  runtimeConfigSnapshot,
  type RuntimeConfig,
} from "@/lib/agent-core/runtime-config"
import {
  modelForTier,
  pickModelTier,
  routerModelForTier,
  type ModelTier,
} from "@/lib/agent-core/model-orchestra"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"

export type SpecialistKind = "faq" | "sales" | "service"

type RoleConfig = {
  model: () => string
  temperature: number
  maxOutputTokens: number
}

let boundRuntime: RuntimeConfig | null = null
let boundTier: ModelTier | null = null
let boundSpecialist: SpecialistKind | null = null

const FALLBACK_PROFILE = MODEL_PROFILES[DEFAULT_PROFILE_NAME]

function profile(): ModelProfile {
  return boundRuntime?.profile ?? FALLBACK_PROFILE
}

function roleConfig(role: SpecialistKind | "router"): RoleConfig {
  const p = profile()
  const cfg = role === "router" ? p.router : p[role]
  return {
    model: () => {
      if (role === "router") {
        return routerModelForTier(p, boundTier ?? "T2")
      }
      if (boundSpecialist === role && boundTier) {
        return modelForTier(p, role, boundTier)
      }
      return cfg.model
    },
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens,
  }
}

/** Call once at the start of each customer turn. */
export async function bindRuntimeConfig() {
  boundRuntime = await getRuntimeConfig()
  boundTier = null
  boundSpecialist = null
  return boundRuntime
}

export function bindOrchestraTier(input: {
  body: string
  turn: UserTurn
  history: HistoryMessage[]
  specialist: SpecialistKind
}) {
  if (!boundRuntime) return
  const decision = pickModelTier({
    body: input.body,
    turn: input.turn,
    history: input.history,
    specialist: input.specialist,
    orchestraMode: boundRuntime.orchestraMode,
  })
  boundTier = decision.tier
  boundSpecialist = input.specialist
  return decision
}

export function getBoundRuntime() {
  return boundRuntime
}

export function getBoundOrchestraDecision() {
  if (!boundRuntime || !boundTier) return null
  return { tier: boundTier, orchestraMode: boundRuntime.orchestraMode }
}

export const AGENT_CONFIG = {
  router: roleConfig("router"),
  faq: roleConfig("faq"),
  sales: roleConfig("sales"),
  service: roleConfig("service"),
} as const

export function specialistConfig(agent: SpecialistKind) {
  return AGENT_CONFIG[agent]
}

export function routerConfig() {
  return AGENT_CONFIG.router
}

export function salesIntakeMode() {
  const raw = process.env.SALES_INTAKE_MODE?.trim().toLowerCase()
  if (raw === "scripted" || raw === "hybrid" || raw === "llm") return raw
  return "llm" as const
}

export type SalesIntakeMode = ReturnType<typeof salesIntakeMode>

/** For logs / health checks */
export async function activeModelSummary() {
  const runtime = await getRuntimeConfig()
  return {
    ...runtimeConfigSummary(runtime),
    salesIntakeMode: salesIntakeMode(),
    routingMode: runtime.routingMode,
  }
}

function runtimeConfigSummary(runtime: RuntimeConfig) {
  return {
    activeProfile: runtime.activeProfile,
    profileLabel: runtime.profile.label,
    router: runtime.profile.router.model,
    faq: runtime.profile.faq.model,
    sales: runtime.profile.sales.model,
    service: runtime.profile.service.model,
    debounceMs: runtime.debounceMs,
    historyLimit: runtime.historyLimit,
    orchestraMode: runtime.orchestraMode,
    source: runtime.source,
  }
}

export { agentRoutingMode, usesLlmFirstRouting, usesHybridRouting, usesRegexRouting, shouldRunDeterministicInterceptors } from "@/lib/agent-core/routing-mode"
