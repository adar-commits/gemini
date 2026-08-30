/** How turns are routed before the specialist LLM runs. */

import { getBoundRuntime } from "@/lib/agent-core/config"

export type AgentRoutingMode = "llm" | "hybrid" | "regex"

export function agentRoutingMode(): AgentRoutingMode {
  const bound = getBoundRuntime()
  if (bound) return bound.routingMode
  const raw = process.env.AGENT_ROUTING_MODE?.trim().toLowerCase()
  if (raw === "regex" || raw === "hybrid" || raw === "llm") return raw
  return "hybrid"
}

export function usesLlmFirstRouting() {
  return agentRoutingMode() === "llm"
}

export function usesRegexRouting() {
  return agentRoutingMode() === "regex"
}

export function usesHybridRouting() {
  return agentRoutingMode() === "hybrid"
}

export function shouldRunDeterministicInterceptors(structuredFlowPending: boolean) {
  if (usesRegexRouting()) return true
  if (usesLlmFirstRouting()) return structuredFlowPending
  return true
}
