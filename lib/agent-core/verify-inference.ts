import { generateText } from "ai"
import {
  activeModelSummary,
  bindRuntimeConfig,
  routerConfig,
  specialistConfig,
} from "@/lib/agent-core/config"
import { getRuntimeConfig, runtimeConfigSnapshot } from "@/lib/agent-core/runtime-config"

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

export async function inferenceConfigSnapshot() {
  await bindRuntimeConfig()
  const runtime = await getRuntimeConfig()
  const active = await activeModelSummary()

  return {
    routingMode: runtime.routingMode,
    active,
    runtime: runtimeConfigSnapshot(runtime),
    codeDefaults: CODE_DEFAULTS,
    globalOverride: process.env.AGENT_MODEL?.trim() || null,
  }
}

/** Live gateway probes — confirms models are callable and returns gateway modelId. */
export async function runInferenceProbes(options?: { includeSales?: boolean }) {
  await bindRuntimeConfig()
  const runtime = await getRuntimeConfig()
  const router = routerConfig()
  const faq = specialistConfig("faq")

  const probes: InferenceProbeResult[] = [
    await probeModel({
      role: "router",
      model: router.model(),
      source: `profile:${runtime.activeProfile}`,
      prompt:
        'Classify silently. Customer: "קיבלתי שטיח ולא אוהב אותו". Reply with one token: FAQ',
      maxOutputTokens: router.maxOutputTokens,
      temperature: router.temperature,
    }),
    await probeModel({
      role: "faq",
      model: faq.model(),
      source: `profile:${runtime.activeProfile}`,
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
        model: sales.model(),
        source: `profile:${runtime.activeProfile}`,
        prompt: 'Reply in Hebrew with one word: שטיח',
        maxOutputTokens: 16,
        temperature: sales.temperature,
      })
    )
  }

  return {
    config: await inferenceConfigSnapshot(),
    probes,
    verified:
      probes.every((probe) => probe.ok) &&
      probes.every(
        (probe) =>
          !probe.gatewayModelId || probe.gatewayModelId === probe.requestedModel
      ),
  }
}
