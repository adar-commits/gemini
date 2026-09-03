export type ResolvedModel = {
  model: string
  /** env var name, or code_default */
  source: string
}

function pickEnvModel(...keys: string[]): ResolvedModel | null {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return { model: value, source: key }
  }
  return null
}

export function resolvedRouterModel(defaultModel: string): ResolvedModel {
  return (
    pickEnvModel("AGENT_ROUTER_MODEL", "AGENT_MODEL") ?? {
      model: defaultModel,
      source: "code_default",
    }
  )
}

export function resolvedSpecialistModel(
  role: "faq" | "sales" | "service",
  defaultModel: string
): ResolvedModel {
  const roleKey =
    role === "faq"
      ? "AGENT_FAQ_MODEL"
      : role === "sales"
        ? "AGENT_SALES_MODEL"
        : "AGENT_SERVICE_MODEL"
  return (
    pickEnvModel(roleKey, "AGENT_MODEL") ?? {
      model: defaultModel,
      source: "code_default",
    }
  )
}

export function modelResolutionReport(defaults: {
  router: string
  specialist: string
}) {
  return {
    router: resolvedRouterModel(defaults.router),
    faq: resolvedSpecialistModel("faq", defaults.specialist),
    sales: resolvedSpecialistModel("sales", defaults.specialist),
    service: resolvedSpecialistModel("service", defaults.specialist),
    note:
      "Supabase runtime config is source of truth when loaded. Env AGENT_*_MODEL overrides apply only when Supabase is unavailable (code_default).",
  }
}
