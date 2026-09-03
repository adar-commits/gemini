import {
  DEFAULT_PROFILE_NAME,
  profileByName,
  type ModelProfile,
  type ProfileName,
  type RoleModelConfig,
} from "@/lib/agent-core/model-profiles"
import { getAgentSupabase } from "@/lib/agents/supabase"
import type { AgentRoutingMode } from "@/lib/agent-core/routing-mode"
import type { OrchestraMode } from "@/lib/agent-core/model-orchestra"

export type RuntimeConfig = {
  activeProfile: ProfileName
  profile: ModelProfile
  routingMode: AgentRoutingMode
  debounceMs: number
  historyLimit: number
  orchestraMode: OrchestraMode
  updatedAt: string | null
  updatedBy: string | null
  source: "supabase" | "code_default" | "env_emergency"
}

type RuntimeRow = {
  active_profile: string
  profile_json: Record<string, unknown> | null
  routing_mode: string | null
  debounce_ms: number | null
  history_limit: number | null
  orchestra_mode: string | null
  updated_at: string | null
  updated_by: string | null
}

const CACHE_TTL_MS = 60_000
let cached: { at: number; value: RuntimeConfig } | null = null

function envRoleModel(role: "router" | "faq" | "sales" | "service"): string | null {
  const key =
    role === "router"
      ? "AGENT_ROUTER_MODEL"
      : role === "faq"
        ? "AGENT_FAQ_MODEL"
        : role === "sales"
          ? "AGENT_SALES_MODEL"
          : "AGENT_SERVICE_MODEL"
  return process.env[key]?.trim() || null
}

function envGlobalModel(): string | null {
  return process.env.AGENT_MODEL?.trim() || null
}

/** Role-specific env wins; Supabase profile beats global AGENT_MODEL. */
function mergeRole(
  base: RoleModelConfig,
  override: Partial<RoleModelConfig> | undefined,
  roleEnvModel: string | null,
  globalEnvModel: string | null,
  fromSupabase: boolean
): RoleModelConfig {
  const model =
    roleEnvModel ??
    (fromSupabase ? base.model : globalEnvModel ?? base.model)
  return {
    model,
    temperature: override?.temperature ?? base.temperature,
    maxOutputTokens: override?.maxOutputTokens ?? base.maxOutputTokens,
  }
}

function parseProfileJson(
  name: ProfileName,
  json: Record<string, unknown> | null
): ModelProfile {
  const base = profileByName(name === "custom" ? "balanced" : name)
  if (!json) return base

  const pick = (role: keyof Pick<ModelProfile, "router" | "faq" | "sales" | "service">) => {
    const raw = json[role]
    if (!raw || typeof raw !== "object") return base[role]
    const o = raw as Record<string, unknown>
    return {
      model: typeof o.model === "string" ? o.model : base[role].model,
      temperature:
        typeof o.temperature === "number" ? o.temperature : base[role].temperature,
      maxOutputTokens:
        typeof o.maxOutputTokens === "number"
          ? o.maxOutputTokens
          : base[role].maxOutputTokens,
    }
  }

  return {
    name: base.name,
    label: base.label,
    router: pick("router"),
    faq: pick("faq"),
    sales: pick("sales"),
    service: pick("service"),
  }
}

function codeDefaultConfig(): RuntimeConfig {
  const profile = profileByName(DEFAULT_PROFILE_NAME)
  const hasEmergency = Boolean(envGlobalModel() || envRoleModel("faq"))
  const globalEnv = envGlobalModel()
  const applyEmergency = (role: "router" | "faq" | "sales" | "service", cfg: RoleModelConfig) =>
    mergeRole(cfg, undefined, envRoleModel(role), globalEnv, false)

  const routingRaw = process.env.AGENT_ROUTING_MODE?.trim().toLowerCase()
  const routingMode: AgentRoutingMode =
    routingRaw === "regex" || routingRaw === "hybrid" || routingRaw === "llm"
      ? routingRaw
      : "hybrid"

  const debounceEnv = Number(process.env.LANDBOT_DEBOUNCE_MS ?? "")
  const debounceMs =
    Number.isFinite(debounceEnv) && debounceEnv > 0 ? debounceEnv : 8000

  return {
    activeProfile: DEFAULT_PROFILE_NAME,
    profile: {
      ...profile,
      router: applyEmergency("router", profile.router),
      faq: applyEmergency("faq", profile.faq),
      sales: applyEmergency("sales", profile.sales),
      service: applyEmergency("service", profile.service),
    },
    routingMode,
    debounceMs,
    historyLimit: 40,
    orchestraMode: "off",
    updatedAt: null,
    updatedBy: null,
    source: hasEmergency ? "env_emergency" : "code_default",
  }
}

export function rowToConfig(row: RuntimeRow): RuntimeConfig {
  const name = (row.active_profile?.trim() || DEFAULT_PROFILE_NAME) as ProfileName
  const base = parseProfileJson(name, row.profile_json)

  const routingRaw = row.routing_mode?.trim().toLowerCase()
  const routingMode: AgentRoutingMode =
    routingRaw === "regex" || routingRaw === "hybrid" || routingRaw === "llm"
      ? routingRaw
      : "hybrid"

  const orchestraRaw = row.orchestra_mode?.trim().toLowerCase()
  const orchestraMode: OrchestraMode =
    orchestraRaw === "off" || orchestraRaw === "aggressive" || orchestraRaw === "conservative"
      ? orchestraRaw
      : "conservative"

  return {
    activeProfile: name,
    profile: {
      ...base,
      name,
    },
    routingMode,
    debounceMs:
      typeof row.debounce_ms === "number" && row.debounce_ms > 0
        ? Math.max(
            row.debounce_ms,
            Number.isFinite(Number(process.env.LANDBOT_DEBOUNCE_MS ?? ""))
              ? Number(process.env.LANDBOT_DEBOUNCE_MS)
              : 0
          )
        : Number.isFinite(Number(process.env.LANDBOT_DEBOUNCE_MS ?? "")) &&
            Number(process.env.LANDBOT_DEBOUNCE_MS) > 0
          ? Number(process.env.LANDBOT_DEBOUNCE_MS)
          : 8000,
    historyLimit:
      typeof row.history_limit === "number" && row.history_limit > 0 ? row.history_limit : 40,
    orchestraMode,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    source: "supabase",
  }
}

export async function getRuntimeConfig(force = false): Promise<RuntimeConfig> {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  try {
    const supabase = getAgentSupabase()
    const { data, error } = await supabase
      .from("hom_agent_runtime_config")
      .select("*")
      .eq("id", "production")
      .maybeSingle()

    if (error || !data) {
      const value = codeDefaultConfig()
      cached = { at: Date.now(), value }
      return value
    }

    const value = rowToConfig(data as RuntimeRow)
    cached = { at: Date.now(), value }
    return value
  } catch {
    const value = codeDefaultConfig()
    cached = { at: Date.now(), value }
    return value
  }
}

export function invalidateRuntimeConfigCache() {
  cached = null
}

export async function saveRuntimeConfig(input: {
  activeProfile?: ProfileName
  profileJson?: Partial<ModelProfile>
  routingMode?: AgentRoutingMode
  debounceMs?: number
  historyLimit?: number
  orchestraMode?: OrchestraMode
  updatedBy?: string
}): Promise<RuntimeConfig> {
  const current = await getRuntimeConfig(true)
  const nextProfileName = input.activeProfile ?? current.activeProfile
  const baseProfile =
    nextProfileName === "custom"
      ? current.profile
      : profileByName(nextProfileName)

  const profileJson = {
    router: { ...baseProfile.router, ...input.profileJson?.router },
    faq: { ...baseProfile.faq, ...input.profileJson?.faq },
    sales: { ...baseProfile.sales, ...input.profileJson?.sales },
    service: { ...baseProfile.service, ...input.profileJson?.service },
  }

  const row = {
    id: "production",
    active_profile: nextProfileName,
    profile_json: profileJson,
    routing_mode: input.routingMode ?? current.routingMode,
    debounce_ms: input.debounceMs ?? current.debounceMs,
    history_limit: input.historyLimit ?? current.historyLimit,
    orchestra_mode: input.orchestraMode ?? current.orchestraMode,
    updated_at: new Date().toISOString(),
    updated_by: input.updatedBy ?? "api",
  }

  const supabase = getAgentSupabase()
  const { error } = await supabase.from("hom_agent_runtime_config").upsert(row)
  if (error) throw error

  invalidateRuntimeConfigCache()
  return getRuntimeConfig(true)
}

export function runtimeConfigSnapshot(config: RuntimeConfig) {
  return {
    activeProfile: config.activeProfile,
    profileLabel: config.profile.label,
    routingMode: config.routingMode,
    agentEngine: process.env.AGENT_ENGINE?.trim() || "v3",
    debounceMs: config.debounceMs,
    historyLimit: config.historyLimit,
    orchestraMode: config.orchestraMode,
    models: {
      router: config.profile.router.model,
      faq: config.profile.faq.model,
      sales: config.profile.sales.model,
      service: config.profile.service.model,
    },
    source: config.source,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    envOverridesPresent: {
      AGENT_MODEL: Boolean(envGlobalModel()),
      AGENT_FAQ_MODEL: Boolean(envRoleModel("faq")),
      AGENT_SALES_MODEL: Boolean(envRoleModel("sales")),
      AGENT_SERVICE_MODEL: Boolean(envRoleModel("service")),
      AGENT_ROUTER_MODEL: Boolean(envRoleModel("router")),
    },
    envOverridesApply: config.source !== "supabase",
  }
}
