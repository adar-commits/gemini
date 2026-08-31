/** @deprecated v3 single-agent — routing_mode column kept for Supabase compatibility only. */

import { getBoundRuntime } from "@/lib/agent-core/config"

export type AgentRoutingMode = "llm" | "hybrid" | "regex"

export function agentRoutingMode(): AgentRoutingMode {
  const bound = getBoundRuntime()
  if (bound) return bound.routingMode
  return "hybrid"
}

/** @deprecated v3 always uses single LLM agent */
export function usesLlmFirstRouting() {
  return true
}

/** @deprecated */
export function usesRegexRouting() {
  return false
}

/** @deprecated */
export function usesHybridRouting() {
  return false
}

/** @deprecated */
export function shouldRunDeterministicInterceptors(_structuredFlowPending: boolean) {
  return false
}
