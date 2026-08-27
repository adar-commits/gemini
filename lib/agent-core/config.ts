/** Owner-confirmed model & inference settings — v2 single source. */

/** Top-tier defaults (Vercel AI Gateway provider/model slugs). Override via env. */
const DEFAULT_SPECIALIST = "anthropic/claude-opus-4.6"
const DEFAULT_ROUTER = "anthropic/claude-sonnet-4.6"

function envModel(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

export const AGENT_CONFIG = {
  router: {
    model: () =>
      envModel("AGENT_ROUTER_MODEL") ||
      envModel("AGENT_MODEL") ||
      DEFAULT_ROUTER,
    temperature: 0.1,
    maxOutputTokens: 96,
  },
  faq: {
    model: () =>
      envModel("AGENT_FAQ_MODEL", "AGENT_MODEL") || DEFAULT_SPECIALIST,
    temperature: 0,
    maxOutputTokens: 800,
  },
  sales: {
    model: () =>
      envModel("AGENT_SALES_MODEL", "AGENT_MODEL") || DEFAULT_SPECIALIST,
    temperature: 0.25,
    maxOutputTokens: 800,
  },
  service: {
    model: () =>
      envModel("AGENT_SERVICE_MODEL", "AGENT_MODEL") || DEFAULT_SPECIALIST,
    temperature: 0.15,
    maxOutputTokens: 800,
  },
} as const

export type SpecialistKind = keyof Pick<typeof AGENT_CONFIG, "faq" | "sales" | "service">

export function specialistConfig(agent: SpecialistKind) {
  return AGENT_CONFIG[agent]
}

export function routerConfig() {
  return AGENT_CONFIG.router
}

/** For logs / health checks */
export function activeModelSummary() {
  return {
    router: AGENT_CONFIG.router.model(),
    faq: AGENT_CONFIG.faq.model(),
    sales: AGENT_CONFIG.sales.model(),
    service: AGENT_CONFIG.service.model(),
  }
}
