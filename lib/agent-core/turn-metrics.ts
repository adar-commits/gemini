import type { ModelTier } from "@/lib/agent-core/model-orchestra"

export type TurnMetrics = {
  startedAt: number
  llmCalls: number
  inputTokens: number
  outputTokens: number
  modelsUsed: string[]
  tier: ModelTier | null
  profile: string | null
  fallbackLayer: string | null
  routingPath: string | null
}

const store = new Map<string, TurnMetrics>()

export function beginTurnMetrics(conversationId: string, profile: string) {
  store.set(conversationId, {
    startedAt: Date.now(),
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    modelsUsed: [],
    tier: null,
    profile,
    fallbackLayer: null,
    routingPath: null,
  })
}

export function recordLlmCall(conversationId: string, model: string) {
  const metrics = store.get(conversationId)
  if (!metrics) return
  metrics.llmCalls += 1
  if (!metrics.modelsUsed.includes(model)) metrics.modelsUsed.push(model)
}

export function recordTurnTokens(
  conversationId: string,
  inputTokens: number,
  outputTokens: number
) {
  const metrics = store.get(conversationId)
  if (!metrics) return
  metrics.inputTokens += inputTokens
  metrics.outputTokens += outputTokens
}

export function setTurnTier(conversationId: string, tier: ModelTier) {
  const metrics = store.get(conversationId)
  if (metrics) metrics.tier = tier
}

export function setRoutingPath(conversationId: string, path: string) {
  const metrics = store.get(conversationId)
  if (metrics) metrics.routingPath = path
}

export function getRoutingPath(conversationId: string) {
  return store.get(conversationId)?.routingPath ?? null
}

export function setFallbackLayer(conversationId: string, layer: string) {
  const metrics = store.get(conversationId)
  if (metrics) metrics.fallbackLayer = layer
}

export function finishTurnMetrics(conversationId: string) {
  const metrics = store.get(conversationId)
  store.delete(conversationId)
  if (!metrics) return null
  return {
    latency_ms: Date.now() - metrics.startedAt,
    llm_calls: metrics.llmCalls,
    input_tokens: metrics.inputTokens,
    output_tokens: metrics.outputTokens,
    models_used: metrics.modelsUsed,
    tier: metrics.tier,
    profile: metrics.profile,
    fallback_layer: metrics.fallbackLayer,
    routing_path: metrics.routingPath,
  }
}
