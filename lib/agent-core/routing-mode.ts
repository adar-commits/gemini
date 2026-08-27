/** How turns are routed before the specialist LLM runs. */

export type AgentRoutingMode = "llm" | "hybrid" | "regex"

/** Default llm — router + specialist think; regex only for structured mid-flow. */
export function agentRoutingMode(): AgentRoutingMode {
  const raw = process.env.AGENT_ROUTING_MODE?.trim().toLowerCase()
  if (raw === "regex" || raw === "hybrid" || raw === "llm") return raw
  return "llm"
}

export function usesLlmFirstRouting() {
  return agentRoutingMode() === "llm"
}

export function usesRegexRouting() {
  return agentRoutingMode() === "regex"
}

/** Hybrid: LLM router always; regex interceptors still run before specialist. */
export function usesHybridRouting() {
  return agentRoutingMode() === "hybrid"
}

export function shouldRunDeterministicInterceptors(structuredFlowPending: boolean) {
  if (usesRegexRouting()) return true
  if (usesLlmFirstRouting()) return structuredFlowPending
  return true
}
