import { generateText, stepCountIs } from "ai"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
import { homAgentLearnedRulesSection } from "@/lib/agents/learned-rules"
import { ownerAnswersSection } from "@/lib/agents/goku-questions"
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

const MAX_TOOL_ROUNDS = 2
/** Error fallback must be cheaper than the primary model, never more expensive. */
const INVOKE_FALLBACK_MODEL = "anthropic/claude-haiku-4.5"

/**
 * Gateway-managed prompt caching: adds Anthropic cache markers automatically
 * (5-min TTL). The big system prompt is re-billed at ~10% on cache hits —
 * multi-step tool turns and active conversations benefit most.
 */
const GATEWAY_PROVIDER_OPTIONS = { gateway: { caching: "auto" as const } }

type InvokeContext = {
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  body: string
  phone?: string
  sessionSummary?: string | null
  learnedRules?: string | null
  ownerAnswers?: string | null
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
  const t = profile.profile.faq.temperature
  return typeof t === "number" && t >= 0 && t <= 1 ? t : 0.15
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
  learnedRules?: string | null
  ownerAnswers?: string | null
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
    learnedRules: input.learnedRules,
    ownerAnswers: input.ownerAnswers,
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
  const [learnedRules, ownerAnswers] = await Promise.all([
    homAgentLearnedRulesSection(),
    ownerAnswersSection(),
  ])
  const ctx = buildInvokeContext({ ...input, runtime, learnedRules, ownerAnswers })

  try {
    return await invokeWithTools(ctx)
  } catch (error) {
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
    learnedRules: ctx.learnedRules,
    ownerAnswers: ctx.ownerAnswers,
  })
  const tools = createHomAgentTools({
    body: ctx.body,
    phone: ctx.phone,
    history: ctx.history,
  })

  const messages = buildModelMessages(ctx.history, ctx.turn)

  // Single pass: the model may call tools (up to MAX_TOOL_ROUNDS steps) and must
  // finish with the structured { reply, action } output in the same call — the
  // large system prompt is billed once per turn instead of twice.
  const result = await generateText({
    model: ctx.model,
    system: `${system}\n\nIf you need live data, call the appropriate tool first. Do not invent order status, stock, or documents. Base the reply on tool results exactly — never contradict them.`,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_TOOL_ROUNDS + 1),
    temperature: homAgentTemperature(ctx.runtime),
    maxOutputTokens: homAgentMaxTokens(ctx.runtime),
    output: homAgentOutputSchema(),
    providerOptions: GATEWAY_PROVIDER_OPTIONS,
  })

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: result.usage,
  })

  setRoutingPath(
    ctx.conversationId,
    (result.steps?.length ?? 0) > 1 ? "v3_tools" : "v3_llm"
  )

  const deterministicReply = extractDeterministicToolReply(result.steps)
  const usableEarly = deterministicReply ? extractUsableOutput(result) : null
  if (
    deterministicReply &&
    // A tool's canned "temporary system failure" apology must never outrank a
    // real answer the model composed after seeing that failure.
    !(usableEarly && isToolFailureTemplateReply(deterministicReply.reply))
  ) {
    return {
      output: validateHomAgentReply(deterministicReply, ctx.body, ctx.phone, ctx.history),
      llmCalls: 1,
      model: ctx.model,
    }
  }

  if (hasToolRecoverySignal(result.steps) && !deterministicReply) {
    const recovery = await generateText({
      model: ctx.model,
      system: `${system}\n\nA previous tool call was rejected as misrouted or non-definitive for this turn. Re-evaluate the user's intent semantically and answer directly. Call tools again only if the user explicitly asks for live data matching that tool. CRITICAL: you have NO lookup results — never claim you checked, found, or see orders/stock/documents, and never promise to check and come back (no "רגע אחד ואחזור", no "אבדוק ואעדכן"). Answer from context/KB or ask the customer for what you need.`,
      messages: [
        ...messages,
        {
          role: "user",
          content: `[Tool call was rejected as misrouted/uncertain. Compose the best direct customer reply for: ${ctx.body}]`,
        },
      ],
      temperature: homAgentTemperature(ctx.runtime),
      maxOutputTokens: homAgentMaxTokens(ctx.runtime),
      output: homAgentOutputSchema(),
      providerOptions: GATEWAY_PROVIDER_OPTIONS,
    })

    recordTokenUsage({
      conversationId: ctx.conversationId,
      purpose: "faq",
      agent: "faq",
      model: ctx.model,
      usage: recovery.usage,
    })
    setRoutingPath(ctx.conversationId, "v3_tool_recover")

    const recovered = extractUsableOutput(recovery)
    if (recovered) {
      return {
        output: validateHomAgentReply(recovered, ctx.body, ctx.phone, ctx.history),
        llmCalls: 2,
        model: ctx.model,
      }
    }
    return finalizeStructuredOutput(recovery, ctx, 2)
  }

  const usable = usableEarly ?? extractUsableOutput(result)
  if (usable) {
    return {
      output: validateHomAgentReply(usable, ctx.body, ctx.phone, ctx.history),
      llmCalls: 1,
      model: ctx.model,
    }
  }

  // Guaranteed final word: the step budget was exhausted while the last step was
  // still a tool call, so there is no sendable text. Run one tool-free
  // composition pass instead of falling back to the never-stuck template.
  const toolSummaries = (result.steps ?? [])
    .flatMap((step) => step.toolResults ?? [])
    .map((toolResult) => JSON.stringify(toolResult.output))
    .filter(Boolean)

  const finalWord = await generateText({
    model: ctx.model,
    system,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          toolSummaries.length > 0
            ? `[Tool results — use exactly, do not invent:\n${toolSummaries.join("\n")}\n]\nCompose the final customer reply for: ${ctx.body}`
            : `[Compose the final customer reply for: ${ctx.body}]`,
      },
    ],
    temperature: homAgentTemperature(ctx.runtime),
    maxOutputTokens: homAgentMaxTokens(ctx.runtime),
    output: homAgentOutputSchema(),
    providerOptions: GATEWAY_PROVIDER_OPTIONS,
  })

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: finalWord.usage,
  })
  setRoutingPath(ctx.conversationId, "v3_final_word")

  return finalizeStructuredOutput(finalWord, ctx, 2)
}

async function invokeKbOnly(ctx: InvokeContext) {
  const system = buildHomAgentSystemPrompt({
    sessionSummary: ctx.sessionSummary,
    whatsappPhone: ctx.phone,
    userText: ctx.body,
    history: ctx.history,
    learnedRules: ctx.learnedRules,
    ownerAnswers: ctx.ownerAnswers,
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
    providerOptions: GATEWAY_PROVIDER_OPTIONS,
  })

  recordTokenUsage({
    conversationId: ctx.conversationId,
    purpose: "faq",
    agent: "faq",
    model: ctx.model,
    usage: structured.usage,
  })

  setRoutingPath(ctx.conversationId, "v3_kb_only")

  return finalizeStructuredOutput(structured, ctx, 1)
}

type StructuredResultLike = {
  output?: Partial<HomAgentOutput> | null
  text: string
}

/** Parsed output with a sendable reply — null means "nothing to say" (needs recovery). */
function extractUsableOutput(structured: StructuredResultLike): HomAgentOutput | null {
  let parsed: Partial<HomAgentOutput> | null = null
  try {
    parsed = structured.output ?? null
  } catch {
    parsed = null
  }
  const raw = parsed ?? parseFallbackOutput(structured.text)
  const reply = raw.reply?.trim() ?? ""
  const action = normalizeHomAgentAction(raw.action ?? "reply")
  // Non-reply actions (end/reset/handoffs) are meaningful even without text.
  if (!reply && action === "reply") return null
  return { reply, action }
}

function finalizeStructuredOutput(
  structured: StructuredResultLike,
  ctx: InvokeContext,
  llmCalls: number
) {
  // The .output getter can throw on unparseable JSON — fall back to text parsing
  // instead of failing the whole (already billed) call.
  let parsed: Partial<HomAgentOutput> | null = null
  try {
    parsed = structured.output ?? null
  } catch {
    parsed = null
  }
  const raw = parsed ?? parseFallbackOutput(structured.text)
  const normalized: HomAgentOutput = {
    reply: raw.reply ?? "",
    action: normalizeHomAgentAction(raw.action ?? "reply"),
  }

  return {
    output: validateHomAgentReply(normalized, ctx.body, ctx.phone, ctx.history),
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

  // Truncated JSON (output-token cap hit mid-object, e.g. `..."action":"re`):
  // extract the reply string value up to its closing unescaped quote so the
  // dangling `","action":"…` tail never reaches the customer.
  const truncated = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (truncated?.[1]) {
    const reply = truncated[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim()
    if (reply) return { reply, action: "reply" }
  }

  return { reply: text.trim(), action: "reply" }
}

/** Canned failure/confusion templates from tools — never outrank a composed model answer. */
function isToolFailureTemplateReply(reply: string) {
  return /תקלה זמנית במערכת|לא הצלחתי ל(?:משוך|בדוק) את|לא הבנתי/i.test(reply)
}

type ToolStep = {
  toolResults?: ReadonlyArray<{ output?: unknown; toolName?: string }>
}

/** Operational tools return final customer copy — skip the LLM's own composition, which may contradict live data. */
function extractDeterministicToolReply(
  steps: readonly ToolStep[] | undefined
): HomAgentOutput | null {
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

function hasToolRecoverySignal(steps: readonly ToolStep[] | undefined) {
  for (const step of steps ?? []) {
    for (const result of step.toolResults ?? []) {
      const output = result.output as
        | { ok?: boolean; errorCode?: string; error?: string }
        | undefined
      if (!output || output.ok !== false) continue
      if (isRecoverableToolErrorCode(output.errorCode)) {
        return true
      }
    }
  }
  return false
}

function isRecoverableToolErrorCode(errorCode?: string) {
  if (!errorCode) return false
  return (
    errorCode.startsWith("lookup_") ||
    errorCode.startsWith("inventory_") ||
    errorCode.startsWith("document_")
  )
}
