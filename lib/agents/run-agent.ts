import { generateText, jsonSchema, Output } from "ai"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { guessMasterRoute, stickySpecialist } from "@/lib/agents/route-intent"
import {
  ACTIONS_BY_AGENT,
  CUSTOMER_HEADER,
  MASTER_ACTIONS,
  MASTER_ROUTE_MAP,
  SILENT_ACTIONS,
  isSpecialistId,
  type AgentAction,
  type AgentId,
  type AgentResponse,
  type ConversationalAction,
  type HistoryMessage,
  type MasterAction,
} from "@/lib/agents/types"

const DEFAULT_MODEL = "anthropic/claude-sonnet-5"
const DEFAULT_ROUTER_MODEL = "google/gemini-2.5-flash-lite"

function specialistModel() {
  return process.env.AGENT_MODEL?.trim() || DEFAULT_MODEL
}

function routerModel() {
  return (
    process.env.AGENT_ROUTER_MODEL?.trim() ||
    process.env.AGENT_MODEL?.trim() ||
    DEFAULT_ROUTER_MODEL
  )
}

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

function toModelMessages(history: HistoryMessage[], body: string) {
  return [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: body },
  ]
}

export async function runAgent(
  agent: AgentId,
  conversationId: string,
  body: string,
  options?: { persistUser?: boolean; history?: HistoryMessage[] }
): Promise<AgentResponse> {
  const history = options?.history ?? (await getConversationContext(conversationId)).history
  const allowed = ACTIONS_BY_AGENT[agent]
  const isMaster = agent === "master"
  const model = isMaster ? routerModel() : specialistModel()

  const result = await generateText({
    model,
    system: getSystemPrompt(agent, body),
    messages: toModelMessages(history, body),
    maxOutputTokens: isMaster ? 80 : 800,
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

  const fallback: AgentAction = isMaster ? "ROUTE_TO_INFO_AGENT" : "reply"
  let rawAction = ""
  let rawReply = ""
  try {
    rawAction = String(result.output.action ?? "")
    rawReply =
      "reply" in result.output ? String(result.output.reply ?? "") : ""
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
    persistUser: options?.persistUser,
  })

  return {
    ok: true,
    agent,
    reply,
    action: action as ConversationalAction | MasterAction,
  }
}

async function resolveSpecialist(
  conversationId: string,
  body: string,
  specialist: AgentId,
  history: HistoryMessage[],
  persistUser: boolean,
  route: AgentId[]
): Promise<AgentResponse> {
  route.push(specialist)
  let result = await runAgent(specialist, conversationId, body, {
    persistUser,
    history,
  })

  if (isSpecialistId(result.action) && result.action !== specialist) {
    route.push(result.action)
    result = await runAgent(result.action, conversationId, body, {
      persistUser: false,
      history,
    })
  }

  return { ...result, route }
}

function shippingResult(route: AgentId[]): AgentResponse {
  return {
    ok: true,
    agent: "master",
    reply: "",
    action: "shipping",
    route,
  }
}

export async function runMasterConversation(
  conversationId: string,
  body: string
): Promise<AgentResponse> {
  const { history, lastAgent, lastAction } =
    await getConversationContext(conversationId)
  const route: AgentId[] = []
  const sticky = stickySpecialist(lastAgent, lastAction)

  if (sticky) {
    return resolveSpecialist(conversationId, body, sticky, history, true, route)
  }

  const guessed = guessMasterRoute(body)
  let masterAction: MasterAction

  if (guessed) {
    masterAction = guessed
    route.push("master")
    await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: "",
      action: masterAction,
    })
  } else {
    const master = await runAgent("master", conversationId, body, { history })
    route.push("master")
    masterAction = (MASTER_ROUTE_MAP[master.action as MasterAction]
      ? master.action
      : "ROUTE_TO_INFO_AGENT") as MasterAction
  }

  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") return shippingResult(route)

  return resolveSpecialist(
    conversationId,
    body,
    next,
    history,
    false,
    route
  )
}
