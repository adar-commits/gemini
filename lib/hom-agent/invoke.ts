import { generateText, stepCountIs } from "ai"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
import { MODEL_PROFILES } from "@/lib/agent-core/model-profiles"
import { recordTokenUsage } from "@/lib/agent-core/token-usage"
import { setRoutingPath } from "@/lib/agent-core/turn-metrics"
import { buildModelMessages } from "@/lib/agents/multimodal"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"
import { buildHomAgentSystemPrompt } from "@/lib/hom-agent/prompt"
import {
  homAgentOutputSchema,
  normalizeHomAgentAction,
  type HomAgentOutput,
} from "@/lib/hom-agent/output-schema"
import { createHomAgentTools } from "@/lib/hom-agent/tools"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"
import { debugSessionLog } from "@/lib/debug/session-log"

const MAX_TOOL_ROUNDS = 2
const INVOKE_FALLBACK_MODEL = MODEL_PROFILES.balanced.faq.model

type InvokeContext = {
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  body: string
  phone?: string
  sessionSummary?: string | null
  model: string
  runtime: Awaited<ReturnType<typeof bindRuntimeConfig>>
}

function homAgentModel(
  profile: Awaited<ReturnType<typeof bindRuntimeConfig>>,
  override?: string
) {
  return override?.trim() || profile.profile.faq.model
}

function homAgentTemperature(profile: Awaited<ReturnType<typeof bindRuntimeConfig>>) {
  return 0.15
}

function homAgentMaxTokens(profile: Awaited<ReturnType<typeof bindRuntimeConfig>>) {
  return profile.profile.faq.maxOutputTokens
}

function buildInvokeContext(input: {
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  body: string
  phone?: string
  sessionSummary?: string | null
  modelOverride?: string
  runtime: Awaited<ReturnType<typeof bindRuntimeConfig>>
}): InvokeContext {
  return {
    conversationId: input.conversationId,
    turn: input.turn,
    history: input.history,
    body: input.body,
    phone: input.phone,
    sessionSummary: input.sessionSummary,
    model: homAgentModel(input.runtime, input.modelOverride),
    runtime: input.runtime,
  }
}

export async function invokeHomAgent(input: {
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  body: string
  phone?: string
  sessionSummary?: string | null
  /** Retry path — use a lighter model when the primary call failed instantly. */
  modelOverride?: string
}): Promise<{ output: HomAgentOutput; llmCalls: number; model: string }> {
  const runtime = await bindRuntimeConfig()
  const ctx = buildInvokeContext({ ...input, runtime })

  try {
    return await invokeWithTools(ctx)
  } catch (error) {
    // #region agent log
    debugSessionLog({
      location: "invoke.ts:invokeHomAgent",
      message: "tool pass failed",
      hypothesisId: "H4",
      data: {
        conversationId: input.conversationId,
        model: ctx.model,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    // #endregion
    console.warn("[hom-agent] tool invoke failed, trying kb-only pass", {
      conversationId: input.conversationId,
      model: ctx.model,
      error: error instanceof Error ? error.message : error,
    })
    const kbModel =
      ctx.model === INVOKE_FALLBACK_MODEL ? ctx.model : INVOKE_FALLBACK_MODEL
    try {
      return await invokeKbOnly({ ...ctx, model: kbModel })
    } catch (kbError) {
      // #region agent log
      debugSessionLog({
        location: "invoke.ts:invokeHomAgent",
        message: "kb-only pass failed",
        hypothesisId: "H4",
        data: {
          conversationId: input.conversationId,
          model: kbModel,
          error: kbError instanceof Error ? kbError.message : String(kbError),
        },
      })
      // #endregion
      throw kbError
    }
  }
}

async function invokeWithTools(ctx: InvokeContext) {
  const system = buildHomAgentSystemPrompt({
    sessionSummary: ctx.sessionSummary,
    whatsappPhone: ctx.phone,
    userText: ctx.body,
    history: ctx.history,
  })
  const tools = createHomAgentTools({
    body: ctx.body,
    phone: ctx.phone,
    history: ctx.history,
  })

  let llmCalls = 0
  const messages = buildModelMessages(ctx.history, ctx.turn)

  const toolResult = await generateText({
    model: ctx.model,
    system: `${system}\n\nIf you need live data, call the appropriate tool first. Do not invent order status, stock, or documents.`,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
    temperature: homAgentTemperature(ctx.runtime),
    maxOutputTokens: Math.min(homAgentMaxTokens(ctx.runtime), 900),
  })
  llmCalls += 1

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: toolResult.usage,
  })

  setRoutingPath(
    ctx.conversationId,
    (toolResult.steps?.length ?? 0) > 1 ? "v3_tools" : "v3_llm"
  )

  const deterministicReply = extractDeterministicToolReply(toolResult.steps)
  if (deterministicReply) {
    return {
      output: validateHomAgentReply(deterministicReply, ctx.body, ctx.phone),
      llmCalls,
      model: ctx.model,
    }
  }

  const toolSummaries = (toolResult.steps ?? [])
    .flatMap((step) => step.toolResults ?? [])
    .map((result) => JSON.stringify(result.output))
    .filter(Boolean)

  const structured = await generateText({
    model: ctx.model,
    system,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          toolSummaries.length > 0
            ? `[Tool results — use exactly in your reply, do not invent:\n${toolSummaries.join("\n")}\n]\nCompose the final customer reply for: ${ctx.body}`
            : `[Compose the final customer reply for: ${ctx.body}`,
      },
    ],
    temperature: homAgentTemperature(ctx.runtime),
    maxOutputTokens: homAgentMaxTokens(ctx.runtime),
    output: homAgentOutputSchema(),
  })
  llmCalls += 1

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: structured.usage,
  })

  return finalizeStructuredOutput(structured, ctx, llmCalls)
}

async function invokeKbOnly(ctx: InvokeContext) {
  const system = buildHomAgentSystemPrompt({
    sessionSummary: ctx.sessionSummary,
    whatsappPhone: ctx.phone,
    userText: ctx.body,
    history: ctx.history,
  })
  const messages = buildModelMessages(ctx.history, ctx.turn)

  const structured = await generateText({
    model: ctx.model,
    system: `${system}\n\nTools are unavailable this turn. Answer from the knowledge base only. For live order status, ask for order number or offer human_service — do not invent status.`,
    messages: [
      ...messages,
      {
        role: "user",
        content: `[Compose the final customer reply for: ${ctx.body}`,
      },
    ],
    temperature: homAgentTemperature(ctx.runtime),
    maxOutputTokens: homAgentMaxTokens(ctx.runtime),
    output: homAgentOutputSchema(),
  })

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: structured.usage,
  })

  setRoutingPath(ctx.conversationId, "v3_kb_only")

  // #region agent log
  debugSessionLog({
    location: "invoke.ts:invokeKbOnly",
    message: "kb-only pass ok",
    hypothesisId: "H4",
    data: { conversationId: ctx.conversationId, model: ctx.model },
  })
  // #endregion

  return finalizeStructuredOutput(structured, ctx, 1)
}

function finalizeStructuredOutput(
  structured: Awaited<ReturnType<typeof generateText>>,
  ctx: InvokeContext,
  llmCalls: number
) {
  const raw = structured.output ?? parseFallbackOutput(structured.text)
  const normalized: HomAgentOutput = {
    reply: raw.reply ?? "",
    action: normalizeHomAgentAction(raw.action ?? "reply"),
  }

  return {
    output: validateHomAgentReply(normalized, ctx.body, ctx.phone),
    llmCalls,
    model: ctx.model,
  }
}

export { INVOKE_FALLBACK_MODEL }

function parseFallbackOutput(text: string): HomAgentOutput {
  try {
    const match = text.match(/\{[\s\S]*"reply"[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as HomAgentOutput
      return parsed
    }
  } catch {
    // fall through
  }
  return { reply: text.trim(), action: "reply" }
}

type ToolStep = NonNullable<Awaited<ReturnType<typeof generateText>>["steps"]>[number]

/** Operational tools return final customer copy — skip a second LLM pass that may contradict live data. */
function extractDeterministicToolReply(steps: ToolStep[] | undefined): HomAgentOutput | null {
  for (const step of steps ?? []) {
    for (const result of step.toolResults ?? []) {
      const output = result.output as
        | { ok?: boolean; reply?: string; action?: string }
        | undefined
      if (!output?.ok || !output.reply?.trim()) continue
      const action =
        output.action === "human_service" || output.action === "human_sales"
          ? output.action
          : "reply"
      return { reply: output.reply.trim(), action }
    }
  }
  return null
}
