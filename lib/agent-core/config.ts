/** Owner-confirmed model & inference settings — v2 single source. */

import { agentRoutingMode } from "@/lib/agent-core/routing-mode"
import { modelResolutionReport } from "@/lib/agent-core/model-resolution"

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
  const resolution = modelResolutionReport({
    router: DEFAULT_ROUTER,
    specialist: DEFAULT_SPECIALIST,
  })
  return {
    router: AGENT_CONFIG.router.model(),
    faq: AGENT_CONFIG.faq.model(),
    sales: AGENT_CONFIG.sales.model(),
    service: AGENT_CONFIG.service.model(),
    salesIntakeMode: salesIntakeMode(),
    routingMode: agentRoutingMode(),
    resolution,
    envOverridesCodeDefaults:
      resolution.router.source !== "code_default" ||
      resolution.faq.source !== "code_default" ||
      resolution.sales.source !== "code_default" ||
      resolution.service.source !== "code_default",
    globalOverride: process.env.AGENT_MODEL?.trim() || null,
  }
}

export { agentRoutingMode, type AgentRoutingMode } from "@/lib/agent-core/routing-mode"
export type SalesIntakeMode = "llm" | "scripted" | "hybrid"

export function salesIntakeMode(): SalesIntakeMode {
  const raw = process.env.SALES_INTAKE_MODE?.trim().toLowerCase()
  if (raw === "scripted" || raw === "hybrid" || raw === "llm") return raw
  return "llm"
}
