import { generateText, jsonSchema, Output } from "ai"
import { buildUserContent } from "@/lib/agents/multimodal"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { guessMasterRoute, stickySpecialist } from "@/lib/agents/route-intent"
import {
  buildGreetingReply,
  hasImmediateBusinessAsk,
  isCasualGreetingWithLearned,
  isOpeningTurn,
} from "@/lib/agents/greeting"
import { guessLearnedRoute, learnedPromptRules, loadLearnedRules } from "@/lib/agents/learned-rules"
import { buildBranchListReply, isBranchListQuestion } from "@/lib/agents/branches"
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

function toModelMessages(history: HistoryMessage[], turn: UserTurn) {
  return [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: buildUserContent(turn) },
  ]
}

export async function runAgent(
  agent: AgentId,
  conversationId: string,
  turn: UserTurn,
  options?: { persistUser?: boolean; history?: HistoryMessage[] }
): Promise<AgentResponse> {
  const body = summarizeTurn(turn)
  const history = options?.history ?? (await getConversationContext(conversationId)).history
  const allowed = ACTIONS_BY_AGENT[agent]
  const isMaster = agent === "master"
  const model = isMaster ? routerModel() : specialistModel()
  const learnedRules = isMaster ? "" : await learnedPromptRules(agent)

  const result = await generateText({
    model,
    system: `${getSystemPrompt(agent, body)}${learnedRules}`,
    messages: toModelMessages(history, turn),
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
  turn: UserTurn,
  specialist: AgentId,
  history: HistoryMessage[],
  persistUser: boolean,
  route: AgentId[],
  options?: { customerName?: string }
): Promise<AgentResponse> {
  route.push(specialist)
  const body = summarizeTurn(turn)
  const userTurns = history.filter((message) => message.role === "user").length

  if (isBranchListQuestion(body)) {
    const reply = normalizeReply("faq", "reply", buildBranchListReply())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route }
  }

  if (
    specialist === "faq" &&
    (await isCasualGreetingWithLearned(body)) &&
    !hasImmediateBusinessAsk(body) &&
    isOpeningTurn(persistUser ? userTurns : userTurns + 1)
  ) {
    const reply = normalizeReply("faq", "reply", buildGreetingReply(options?.customerName))
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route }
  }

  let result = await runAgent(specialist, conversationId, turn, {
    persistUser,
    history,
  })

  if (isSpecialistId(result.action) && result.action !== specialist) {
    route.push(result.action)
    result = await runAgent(result.action, conversationId, turn, {
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
  turn: UserTurn,
  options?: { customerName?: string }
): Promise<AgentResponse> {
  const body = summarizeTurn(turn)
  await loadLearnedRules()
  const { history, lastAgent, lastAction } =
    await getConversationContext(conversationId)
  const route: AgentId[] = []
  const sticky = stickySpecialist(lastAgent, lastAction)

  if (sticky) {
    return resolveSpecialist(
      conversationId,
      turn,
      sticky,
      history,
      true,
      route,
      options
    )
  }

  const learned = await guessLearnedRoute(body)
  const guessed = learned ?? guessMasterRoute(body)
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
    const master = await runAgent("master", conversationId, turn, { history })
    route.push("master")
    masterAction = (MASTER_ROUTE_MAP[master.action as MasterAction]
      ? master.action
      : "ROUTE_TO_INFO_AGENT") as MasterAction
  }

  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") return shippingResult(route)

  return resolveSpecialist(
    conversationId,
    turn,
    next,
    history,
    false,
    route,
    options
  )
}
