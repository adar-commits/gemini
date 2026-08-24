import { generateText, jsonSchema, Output } from "ai"
import { buildUserContent } from "@/lib/agents/multimodal"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { getSystemPrompt } from "@/lib/agents/prompts"
import { guessMasterRoute, shouldContinueWithSpecialist, stickySpecialist } from "@/lib/agents/route-intent"
import {
  buildProductHandoffOffer,
  isProductAvailabilityQuestion,
} from "@/lib/agents/product-handoff"
import {
  buildHumanHandoffConfirmedReply,
  buildHumanHandoffDeclinedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffPending,
  isOffTopicQuestion,
  OFF_TOPIC_HANDOFF_OFFER,
} from "@/lib/agents/off-topic"
import {
  buildCustomerServiceTopicPrompt,
  isCustomerServiceOpener,
} from "@/lib/agents/customer-service-opener"
import { isFaqTopicSwitch } from "@/lib/agents/topic-switch"
import {
  buildGreetingReply,
  hasImmediateBusinessAsk,
  isCasualGreetingWithLearned,
  isOpeningTurn,
  shouldWelcomeAfterReset,
} from "@/lib/agents/greeting"
import { guessLearnedRoute, learnedPromptRules, loadLearnedRules } from "@/lib/agents/learned-rules"
import { buildBranchListReply, isBranchListQuestion } from "@/lib/agents/branches"
import {
  buildPostConfirmationReply,
  buildSalesIntakeReply,
  isConfirmationPending,
  sanitizeSalesReply,
  shouldUseSalesIntakeFastPath,
} from "@/lib/agents/sales-intake"
import {
  buildShippingPolicyReply,
  buildShippingStatusReply,
  isShippingPolicyQuestion,
} from "@/lib/agents/shipping"
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
  options?: { persistUser?: boolean; history?: HistoryMessage[]; preview?: boolean }
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
    preview: options?.preview,
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
  options?: { customerName?: string; lastAgent?: AgentId | null; lastAction?: string | null; resetAt?: string | null; preview?: boolean }
): Promise<AgentResponse> {
  route.push(specialist)
  const body = summarizeTurn(turn)
  const userTurns = history.filter((message) => message.role === "user").length
  const preview = options?.preview

  if (isHumanHandoffPending(history)) {
    const agent = specialist === "master" ? "faq" : specialist
    if (isHumanHandoffAffirmation(body)) {
      const action = inferHumanHandoffAction(history, options?.lastAgent ?? null)
      const reply = `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply(action)}`
      await appendTurn({
        conversationId,
        agent,
        userText: body,
        assistantText: reply,
        action,
        persistUser,
        preview,
      })
      return { ok: true, agent, reply, action, route }
    }
    if (isHumanHandoffDecline(body)) {
      const reply = normalizeReply(agent, "reply", buildHumanHandoffDeclinedReply())
      await appendTurn({
        conversationId,
        agent,
        userText: body,
        assistantText: reply,
        action: "reply",
        persistUser,
        preview,
      })
      return { ok: true, agent, reply, action: "reply", route }
    }
  }

  if (isCustomerServiceOpener(body)) {
    const replyAgent = "faq"
    const reply = normalizeReply(replyAgent, "reply", buildCustomerServiceTopicPrompt())
    await appendTurn({
      conversationId,
      agent: replyAgent,
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ok: true, agent: replyAgent, reply, action: "reply", route }
  }

  if (isOffTopicQuestion(body)) {
    const agent = specialist === "master" ? "faq" : specialist
    const reply = normalizeReply(agent, "reply", OFF_TOPIC_HANDOFF_OFFER)
    await appendTurn({
      conversationId,
      agent,
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ok: true, agent, reply, action: "reply", route }
  }

  if (isFaqTopicSwitch(body)) {
    const replyAgent = "faq"
    if (isShippingPolicyQuestion(body)) {
      const reply = normalizeReply(replyAgent, "reply", buildShippingPolicyReply())
      await appendTurn({
        conversationId,
        agent: replyAgent,
        userText: body,
        assistantText: reply,
        action: "reply",
        persistUser,
        preview,
      })
      return { ok: true, agent: replyAgent, reply, action: "reply", route: [...route, replyAgent] }
    }

    if (isBranchListQuestion(body)) {
      const reply = normalizeReply(replyAgent, "reply", buildBranchListReply())
      await appendTurn({
        conversationId,
        agent: replyAgent,
        userText: body,
        assistantText: reply,
        action: "reply",
        persistUser,
        preview,
      })
      return { ok: true, agent: replyAgent, reply, action: "reply", route: [...route, replyAgent] }
    }

    let result = await runAgent(replyAgent, conversationId, turn, {
      persistUser,
      history,
      preview,
    })

    if (isSpecialistId(result.action) && result.action !== replyAgent) {
      route.push(result.action)
      result = await runAgent(result.action, conversationId, turn, {
        persistUser: false,
        history,
        preview,
      })
    }

    return { ...result, route }
  }

  if (isBranchListQuestion(body)) {
    const reply = normalizeReply("faq", "reply", buildBranchListReply())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route }
  }

  if (
    specialist === "sales" &&
    shouldUseSalesIntakeFastPath(body, history, options?.lastAgent ?? null)
  ) {
    const reply = normalizeReply(
      "sales",
      "reply",
      isConfirmationPending(history)
        ? buildPostConfirmationReply(body, history)
        : buildSalesIntakeReply(history, body)
    )
    await appendTurn({
      conversationId,
      agent: "sales",
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ok: true, agent: "sales", reply, action: "reply", route }
  }

  if (
    specialist === "faq" &&
    (await isCasualGreetingWithLearned(body)) &&
    !hasImmediateBusinessAsk(body) &&
    (isOpeningTurn(persistUser ? userTurns : userTurns + 1) ||
      shouldWelcomeAfterReset(
        options?.resetAt ?? null,
        options?.lastAction ?? null,
        history
      ))
  ) {
    const reply = buildGreetingReply(options?.customerName)
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route }
  }

  let result = await runAgent(specialist, conversationId, turn, {
    persistUser,
    history,
    preview,
  })

  if (specialist === "sales" && result.reply) {
    const sanitized = sanitizeSalesReply(result.reply, history, body)
    if (sanitized !== result.reply) {
      result = { ...result, reply: normalizeReply("sales", "reply", sanitized) }
    }
  }

  if (isSpecialistId(result.action) && result.action !== specialist) {
    route.push(result.action)
    result = await runAgent(result.action, conversationId, turn, {
      persistUser: false,
      history,
      preview,
    })
  }

  return { ...result, route }
}

function shippingResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean
): Promise<AgentResponse> {
  const reply = buildShippingStatusReply()
  return appendTurn({
    conversationId,
    agent: "master",
    userText: body,
    assistantText: reply,
    action: "shipping",
    preview,
  }).then(() => ({
    ok: true,
    agent: "master" as const,
    reply,
    action: "shipping" as const,
    route,
  }))
}

async function tryWelcomeGreeting(
  conversationId: string,
  turn: UserTurn,
  context: {
    history: HistoryMessage[]
    lastAction: string | null
    resetAt: string | null
  },
  options?: { customerName?: string; preview?: boolean }
): Promise<AgentResponse | null> {
  const body = summarizeTurn(turn)
  if (!(await isCasualGreetingWithLearned(body))) return null
  if (hasImmediateBusinessAsk(body)) return null

  const userTurns = context.history.filter((message) => message.role === "user").length
  const welcome =
    isOpeningTurn(userTurns) ||
    shouldWelcomeAfterReset(context.resetAt, context.lastAction, context.history)

  if (!welcome) return null

  const reply = buildGreetingReply(options?.customerName)
  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action: "reply",
    preview: options?.preview,
  })
  return { ok: true, agent: "faq", reply, action: "reply", route: ["faq"] }
}

export async function runMasterConversation(
  conversationId: string,
  turn: UserTurn,
  options?: { customerName?: string; preview?: boolean }
): Promise<AgentResponse> {
  const body = summarizeTurn(turn)
  await loadLearnedRules()
  const { history, lastAgent, lastAction, resetAt } =
    await getConversationContext(conversationId)
  const route: AgentId[] = []
  const preview = options?.preview
  const sharedOptions = { ...options, lastAgent, lastAction, resetAt, preview }

  const welcome = await tryWelcomeGreeting(
    conversationId,
    turn,
    { history, lastAction, resetAt },
    options
  )
  if (welcome) return welcome

  if (isHumanHandoffPending(history)) {
    const agent =
      lastAgent && isSpecialistId(lastAgent) ? lastAgent : ("faq" as const)
    return resolveSpecialist(
      conversationId,
      turn,
      agent,
      history,
      true,
      route,
      sharedOptions
    )
  }

  if (isProductAvailabilityQuestion(body)) {
    const reply = buildProductHandoffOffer(body)
    const agent =
      lastAgent && isSpecialistId(lastAgent) ? lastAgent : ("sales" as const)
    await appendTurn({
      conversationId,
      agent,
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent, reply, action: "reply", route: [...route, agent] }
  }

  if (isFaqTopicSwitch(body)) {
    return resolveSpecialist(
      conversationId,
      turn,
      "faq",
      history,
      true,
      route,
      sharedOptions
    )
  }

  const sticky = stickySpecialist(lastAgent, lastAction)

  if (sticky && shouldContinueWithSpecialist(body, history, sticky)) {
    return resolveSpecialist(
      conversationId,
      turn,
      sticky,
      history,
      true,
      route,
      sharedOptions
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
      preview,
    })
  } else {
    const master = await runAgent("master", conversationId, turn, { history, preview })
    route.push("master")
    masterAction = (MASTER_ROUTE_MAP[master.action as MasterAction]
      ? master.action
      : "ROUTE_TO_INFO_AGENT") as MasterAction
  }

  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") return shippingResult(conversationId, body, route, preview)

  return resolveSpecialist(
    conversationId,
    turn,
    next,
    history,
    false,
    route,
    sharedOptions
  )
}
