import { generateText, jsonSchema, Output } from "ai"
import {
  buildConfusedFallbackReply,
  buildLlmFailureReply,
} from "@/lib/agent-core/fallbacks"
import { routerConfig, specialistConfig } from "@/lib/agent-core/config"
import { setFallbackLayer } from "@/lib/agent-core/turn-metrics"
import { recordTokenUsage, type TokenPurpose } from "@/lib/agent-core/token-usage"
import { buildUserContent, buildModelMessages } from "@/lib/agents/multimodal"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { appendTurn } from "@/lib/agents/memory"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import {
  ACTIONS_BY_AGENT,
  MASTER_ACTIONS,
  SILENT_ACTIONS,
  type AgentAction,
  type AgentId,
  type AgentResponse,
  type ConversationalAction,
  type HistoryMessage,
  type MasterAction,
} from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

function isAction(agent: AgentId, value: string): value is AgentAction {
  return (ACTIONS_BY_AGENT[agent] as readonly string[]).includes(value)
}

function normalizeReply(agent: AgentId, action: AgentAction, reply: string) {
  if (agent === "master" || SILENT_ACTIONS.has(action)) return ""
  let trimmed = reply.trim()
  if (!trimmed) return ""
  trimmed = trimmed.replace(/^(?:\*הום בוט :\)\*\n?)+/g, `${CUSTOMER_HEADER}\n`)
  if (trimmed.startsWith(CUSTOMER_HEADER)) return trimmed
  return `${CUSTOMER_HEADER}\n${trimmed}`
}

async function invokeAgentLlm(input: {
  agent: AgentId
  conversationId: string
  turn: UserTurn
  history: HistoryMessage[]
  modelOverride?: string
  sessionSummary?: string | null
  purpose?: TokenPurpose
}) {
  const { agent, conversationId, turn, history } = input
  const isMaster = agent === "master"
  const inference = isMaster
    ? routerConfig()
    : specialistConfig(agent as "faq" | "sales" | "service")
  const model = input.modelOverride ?? inference.model()
  const body = summarizeTurn(turn)
  const purpose: TokenPurpose =
    input.purpose ?? (isMaster ? "master" : (agent as TokenPurpose))

  let system = getSystemPrompt(agent, body)
  if (input.sessionSummary?.trim()) {
    system += `\n\n### CONVERSATION SUMMARY (internal)\n${input.sessionSummary.trim()}\n`
  }

  const allowed = ACTIONS_BY_AGENT[agent]

  const result = await generateText({
    model,
    system,
    messages: buildModelMessages(history, turn),
    temperature: inference.temperature,
    maxOutputTokens: inference.maxOutputTokens,
    output: Output.object({
      name: "landbot_agent_turn",
      description: isMaster
        ? "Exactly one silent routing action"
        : "Customer reply plus exactly one Landbot routing action",
      schema: isMaster
        ? jsonSchema<{ action: string }>({
            type: "object",
            additionalProperties: false,
            required: ["action"],
            properties: {
              action: { type: "string", enum: [...MASTER_ACTIONS] },
            },
          })
        : jsonSchema<{ action: string; reply: string }>({
            type: "object",
            additionalProperties: false,
            required: ["action", "reply"],
            properties: {
              action: { type: "string", enum: [...allowed] },
              reply: { type: "string" },
            },
          }),
    }),
  })

  recordTokenUsage({
    conversationId,
    purpose,
    agent,
    model,
    usage: result.usage,
  })

  return result
}

export async function safeRunAgent(
  agent: AgentId,
  conversationId: string,
  turn: UserTurn,
  options?: {
    persistUser?: boolean
    history?: HistoryMessage[]
    preview?: boolean
    faqSalesResume?: boolean
    modelOverride?: string
    sessionSummary?: string | null
    finalizeFaqReply?: (reply: string, history: HistoryMessage[]) => string
    postProcessReply?: (
      reply: string,
      history: HistoryMessage[],
      body: string
    ) => { text: string; action?: AgentAction }
  }
): Promise<AgentResponse & { fallbackLayer?: string }> {
  const body = summarizeTurn(turn)
  const history = options?.history ?? []
  const isMaster = agent === "master"
  const fallback: AgentAction = isMaster ? "ROUTE_TO_INFO_AGENT" : "reply"

  let result
  try {
    result = await invokeAgentLlm({
      agent,
      conversationId,
      turn,
      history,
      modelOverride: options?.modelOverride,
      sessionSummary: options?.sessionSummary,
    })
  } catch (firstError) {
    setFallbackLayer(conversationId, "llm_retry")
    try {
      result = await invokeAgentLlm({
        agent,
        conversationId,
        turn,
        history,
        modelOverride: options?.modelOverride,
        sessionSummary: options?.sessionSummary,
        purpose: "retry",
      })
    } catch {
      setFallbackLayer(conversationId, "llm_failure_template")
      const reply = normalizeReply(
        isMaster ? "faq" : agent,
        "reply",
        buildLlmFailureReply()
      )
      await appendTurn({
        conversationId,
        agent: isMaster ? "master" : agent,
        userText: body,
        assistantText: reply,
        action: "reply",
        persistUser: options?.persistUser,
        preview: options?.preview,
      })
      return {
        ok: true,
        agent: isMaster ? "master" : agent,
        reply,
        action: "reply",
        fallbackLayer: "llm_failure_template",
      }
    }
    void firstError
  }

  let rawAction = ""
  let rawReply = ""
  try {
    rawAction = String(result.output.action ?? "")
    rawReply = "reply" in result.output ? String(result.output.reply ?? "") : ""
  } catch {
    setFallbackLayer(conversationId, "parse_failure_template")
    rawAction = fallback
    rawReply = buildConfusedFallbackReply().replace(/^\*הום בוט :\)\*\n?/, "")
  }

  const action = isAction(agent, rawAction) ? rawAction : fallback
  let reply = normalizeReply(agent, action, rawReply)

  if (!reply && !isMaster && action === "reply") {
    setFallbackLayer(conversationId, "empty_reply_template")
    reply = buildConfusedFallbackReply()
  }

  let finalAction = action
  if (options?.postProcessReply && finalAction === "reply") {
    const processed = options.postProcessReply(rawReply, history, body)
    if (processed.action) finalAction = processed.action
    reply = normalizeReply(agent, finalAction, processed.text)
  } else if (
    agent === "faq" &&
    options?.faqSalesResume &&
    finalAction === "reply" &&
    options.finalizeFaqReply
  ) {
    reply = normalizeReply(agent, finalAction, options.finalizeFaqReply(rawReply, history))
  }

  await appendTurn({
    conversationId,
    agent,
    userText: body,
    assistantText: reply,
    action: finalAction,
    persistUser: options?.persistUser,
    preview: options?.preview,
  })

  return {
    ok: true,
    agent,
    reply,
    action: finalAction as ConversationalAction | MasterAction,
  }
}

export { buildUserContent }
