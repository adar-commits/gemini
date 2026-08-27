import { generateText } from "ai"
import {
  activeModelSummary,
  routerConfig,
  specialistConfig,
} from "@/lib/agent-core/config"
import { modelResolutionReport } from "@/lib/agent-core/model-resolution"
import { agentRoutingMode } from "@/lib/agent-core/routing-mode"

const CODE_DEFAULTS = {
  router: "anthropic/claude-sonnet-4.6",
  specialist: "anthropic/claude-opus-4.6",
}

export type InferenceProbeResult = {
  role: string
  requestedModel: string
  requestedSource: string
  /** modelId returned by Vercel AI Gateway — proof the call ran */
  gatewayModelId: string | null
  latencyMs: number
  usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  } | null
  sampleOutput: string | null
  ok: boolean
  error?: string
}

async function probeModel(input: {
  role: string
  model: string
  source: string
  prompt: string
  maxOutputTokens: number
  temperature: number
}): Promise<InferenceProbeResult> {
  const started = Date.now()
  try {
    const result = await generateText({
      model: input.model,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
    })
    return {
      role: input.role,
      requestedModel: input.model,
      requestedSource: input.source,
      gatewayModelId: result.response?.modelId ?? null,
      latencyMs: Date.now() - started,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : null,
      sampleOutput: result.text?.trim().slice(0, 120) || null,
      ok: true,
    }
  } catch (error) {
    return {
      role: input.role,
      requestedModel: input.model,
      requestedSource: input.source,
      gatewayModelId: null,
      latencyMs: Date.now() - started,
      usage: null,
      sampleOutput: null,
      ok: false,
      error: error instanceof Error ? error.message : "Inference probe failed",
    }
  }
}

export function inferenceConfigSnapshot() {
  const resolution = modelResolutionReport(CODE_DEFAULTS)
  const active = activeModelSummary()
  const matchesCodeDefaults =
    resolution.router.model === CODE_DEFAULTS.router &&
    resolution.faq.model === CODE_DEFAULTS.specialist &&
    resolution.sales.model === CODE_DEFAULTS.specialist &&
    resolution.service.model === CODE_DEFAULTS.specialist

  return {
    routingMode: agentRoutingMode(),
    active,
    resolution,
    codeDefaults: CODE_DEFAULTS,
    envOverridesCodeDefaults: !matchesCodeDefaults,
    globalOverride: process.env.AGENT_MODEL?.trim() || null,
  }
}

/** Live gateway probes — confirms models are callable and returns gateway modelId. */
export async function runInferenceProbes(options?: { includeSales?: boolean }) {
  const resolution = modelResolutionReport(CODE_DEFAULTS)
  const router = routerConfig()
  const faq = specialistConfig("faq")

  const probes: InferenceProbeResult[] = [
    await probeModel({
      role: "router",
      model: resolution.router.model,
      source: resolution.router.source,
      prompt:
        'Classify silently. Customer: "קיבלתי שטיח ולא אוהב אותו". Reply with one token: FAQ',
      maxOutputTokens: router.maxOutputTokens,
      temperature: router.temperature,
    }),
    await probeModel({
      role: "faq",
      model: resolution.faq.model,
      source: resolution.faq.source,
      prompt:
        'Customer received a rug and dislikes it. One Hebrew sentence: mention 14-day return policy. No header.',
      maxOutputTokens: 120,
      temperature: faq.temperature,
    }),
  ]

  if (options?.includeSales) {
    const sales = specialistConfig("sales")
    probes.push(
      await probeModel({
        role: "sales",
        model: resolution.sales.model,
        source: resolution.sales.source,
        prompt: 'Reply in Hebrew with one word: שטיח',
        maxOutputTokens: 16,
        temperature: sales.temperature,
      })
    )
  }

  return {
    config: inferenceConfigSnapshot(),
    probes,
    verified:
      probes.every((probe) => probe.ok) &&
      probes.every(
        (probe) =>
          !probe.gatewayModelId || probe.gatewayModelId === probe.requestedModel
      ),
  }
}
