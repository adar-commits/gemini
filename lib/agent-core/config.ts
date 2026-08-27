/** Owner-confirmed model & inference settings — v2 single source. */

const DEFAULT_SPECIALIST = "anthropic/claude-sonnet-5"
const DEFAULT_ROUTER = "google/gemini-2.5-flash"

export const AGENT_CONFIG = {
  router: {
    model: () =>
      process.env.AGENT_ROUTER_MODEL?.trim() ||
      process.env.AGENT_MODEL?.trim() ||
      DEFAULT_ROUTER,
    temperature: 0.1,
    maxOutputTokens: 80,
  },
  faq: {
    model: () => process.env.AGENT_MODEL?.trim() || DEFAULT_SPECIALIST,
    temperature: 0,
    maxOutputTokens: 700,
  },
  sales: {
    model: () => process.env.AGENT_MODEL?.trim() || DEFAULT_SPECIALIST,
    temperature: 0.3,
    maxOutputTokens: 700,
  },
  service: {
    model: () => process.env.AGENT_MODEL?.trim() || DEFAULT_SPECIALIST,
    temperature: 0.2,
    maxOutputTokens: 700,
  },
} as const

export type SpecialistKind = keyof Pick<typeof AGENT_CONFIG, "faq" | "sales" | "service">

export function specialistConfig(agent: SpecialistKind) {
  return AGENT_CONFIG[agent]
}

export function routerConfig() {
  return AGENT_CONFIG.router
}
