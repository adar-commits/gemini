import { generateText, stepCountIs } from "ai"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
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

function homAgentModel(profile: Awaited<ReturnType<typeof bindRuntimeConfig>>) {
  return profile.profile.faq.model
}

function homAgentTemperature(profile: Awaited<ReturnType<typeof bindRuntimeConfig>>) {
  return 0.15
}

function homAgentMaxTokens(profile: Awaited<ReturnType<typeof bindRuntimeConfig>>) {
  return profile.profile.faq.maxOutputTokens
}

export async function invokeHomAgent(input: {
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  body: string
  phone?: string
  sessionSummary?: string | null
}): Promise<{ output: HomAgentOutput; llmCalls: number; model: string }> {
  const runtime = await bindRuntimeConfig()
  const model = homAgentModel(runtime)
  const system = buildHomAgentSystemPrompt({
    sessionSummary: input.sessionSummary,
    whatsappPhone: input.phone,
    userText: input.body,
    history: input.history,
  })

  const tools = createHomAgentTools({
    body: input.body,
    phone: input.phone,
    history: input.history,
  })

  let llmCalls = 0
  const messages = buildModelMessages(input.history, input.turn)

  const toolResult = await generateText({
    model,
    system: `${system}\n\nIf you need live data, call the appropriate tool first. Do not invent order status, stock, or documents.`,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
    temperature: homAgentTemperature(runtime),
    maxOutputTokens: Math.min(homAgentMaxTokens(runtime), 900),
  })
  llmCalls += 1

  recordTokenUsage({
    conversationId: input.conversationId,
    purpose: "faq",
    agent: "faq",
    model,
    usage: toolResult.usage,
  })

  setRoutingPath(input.conversationId, (toolResult.steps?.length ?? 0) > 1 ? "v3_tools" : "v3_llm")

  const deterministicReply = extractDeterministicToolReply(toolResult.steps)
  if (deterministicReply) {
    return {
      output: validateHomAgentReply(deterministicReply, input.body),
      llmCalls,
      model,
    }
  }

  const toolSummaries = (toolResult.steps ?? [])
    .flatMap((step) => step.toolResults ?? [])
    .map((result) => JSON.stringify(result.output))
    .filter(Boolean)

  const structured = await generateText({
    model,
    system,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          toolSummaries.length > 0
            ? `[Tool results — use exactly in your reply, do not invent:\n${toolSummaries.join("\n")}\n]\nCompose the final customer reply for: ${input.body}`
            : `[Compose the final customer reply for: ${input.body}`,
      },
    ],
    temperature: homAgentTemperature(runtime),
    maxOutputTokens: homAgentMaxTokens(runtime),
    output: homAgentOutputSchema(),
  })
  llmCalls += 1

  recordTokenUsage({
    conversationId: input.conversationId,
    purpose: "faq",
    agent: "faq",
    model,
    usage: structured.usage,
  })

  const raw = structured.output ?? parseFallbackOutput(structured.text)
  const normalized: HomAgentOutput = {
    reply: raw.reply ?? "",
    action: normalizeHomAgentAction(raw.action ?? "reply"),
  }

  return {
    output: validateHomAgentReply(normalized, input.body),
    llmCalls,
    model,
  }
}

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
