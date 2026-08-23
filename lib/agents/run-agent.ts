import { generateText, jsonSchema, Output } from "ai"
import { appendTurn, getHistory } from "@/lib/agents/memory"
import { getSystemPrompt } from "@/lib/agents/prompts"
import {
  ACTIONS_BY_AGENT,
  CUSTOMER_HEADER,
  SILENT_ACTIONS,
  type AgentAction,
  type AgentId,
  type AgentResponse,
  type ConversationalAction,
  type MasterAction,
} from "@/lib/agents/types"

const DEFAULT_MODEL = "anthropic/claude-sonnet-5"

function isAction(agent: AgentId, value: string): value is AgentAction {
  return (ACTIONS_BY_AGENT[agent] as readonly string[]).includes(value)
}

function normalizeReply(agent: AgentId, action: AgentAction, reply: string) {
  if (agent === "master" || SILENT_ACTIONS.has(action)) return ""

  const trimmed = reply.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith(CUSTOMER_HEADER) || trimmed.startsWith("הום בוט :)")) {
    return trimmed.replace(/^הום בוט :\)\s*/, `${CUSTOMER_HEADER}\n`)
  }
  return `${CUSTOMER_HEADER}\n${trimmed}`
}

export async function runAgent(
  agent: AgentId,
  conversationId: string,
  body: string
): Promise<AgentResponse> {
  const history = await getHistory(conversationId)
  const allowed = ACTIONS_BY_AGENT[agent]
  const model = process.env.AGENT_MODEL?.trim() || DEFAULT_MODEL

  const result = await generateText({
    model,
    system: getSystemPrompt(agent),
    messages: [
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user" as const, content: body },
    ],
    output: Output.object({
      name: "landbot_agent_turn",
      description: "Customer reply plus exactly one Landbot routing action",
      schema: jsonSchema<{ action: string; reply: string }>({
        type: "object",
        additionalProperties: false,
        required: ["action", "reply"],
        properties: {
          action: {
            type: "string",
            enum: [...allowed],
          },
          reply: { type: "string" },
        },
      }),
    }),
  })

  const fallback: AgentAction =
    agent === "master" ? "ROUTE_TO_INFO_AGENT" : "reply"
  let rawAction = ""
  let rawReply = ""
  try {
    rawAction = result.output.action
    rawReply = result.output.reply
  } catch {
    rawAction = fallback
  }
  const action = isAction(agent, rawAction) ? rawAction : fallback
  const reply = normalizeReply(agent, action, rawReply)

  await appendTurn({
    conversationId,
    agent,
    userText: body,
    assistantText: reply,
    action,
  })

  return {
    ok: true,
    agent,
    reply,
    action: action as ConversationalAction | MasterAction,
  }
}
