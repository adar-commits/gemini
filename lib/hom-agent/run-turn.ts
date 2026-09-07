import {
  bindPriorityApiBeforeCall,
  bindPriorityApiEnabled,
  bindPriorityApiLogContext,
  bindPriorityApiPreMessageGuard,
  isPriorityApiWaitMessage,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import { isGatewayBudgetExceeded } from "@/lib/agent-core/gateway-errors"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
import {
  beginTurnMetrics,
  finishTurnMetrics,
  setFallbackLayer,
  setTurnTier,
} from "@/lib/agent-core/turn-metrics"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { scheduleGokuTrainer } from "@/lib/agents/goku-trainer"
import { maybeRefreshConversationSummary } from "@/lib/agents/session-summary"
import { isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { isOrderConfirmationPending } from "@/lib/agents/order-lookup"
import type { AgentResponse, ConversationalAction, HistoryMessage } from "@/lib/agents/types"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { invokeHomAgent, INVOKE_FALLBACK_MODEL } from "@/lib/hom-agent/invoke"
import { shouldRetryInvokeAfterFailure } from "@/lib/hom-agent/invoke-retry"
import { runPreTurnGuards, runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HomAgentAction } from "@/lib/hom-agent/output-schema"
import {
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
import { enrichReturnPickupIntake } from "@/lib/agents/order-lookup"
import {
  answerCombinedQuestions,
  looksLikeMultipleQuestions,
  splitOrderedQuestions,
} from "@/lib/agents/multi-question"

function mapHomAction(action: HomAgentAction): ConversationalAction {
  if (action === "human_sales" || action === "human_service") return action
  if (action === "reset" || action === "end") return action
  return "reply"
}

function mapHomAgent(action: HomAgentAction): AgentResponse["agent"] {
  if (action === "human_sales") return "sales"
  if (action === "human_service") return "service"
  return "faq"
}

function maybeScheduleGokuTrainer(
  conversationId: string,
  action: ConversationalAction
) {
  if (action === "reset") scheduleGokuTrainer(conversationId, "reset")
  else if (action === "end") scheduleGokuTrainer(conversationId, "end")
  else if (action === "human_sales" || action === "human_service") {
    // "Referred to human" counts as a conversation ending for GOKU review.
    scheduleGokuTrainer(conversationId, "handoff")
  }
}

async function rebuildReturnPickupServiceReplyIfNeeded(input: {
  reply: string
  body: string
  phone?: string
  history: HistoryMessage[]
}) {
  if (!isReturnPickupAwaitingThread(input.history, input.body)) return input.reply
  if (!/מסכם את הפנייה/i.test(input.reply)) return input.reply

  let intake = extractServiceIntake(input.history, input.body)
  intake.issueKind = "return_pickup_pending"
  intake = await enrichReturnPickupIntake(intake, {
    body: input.body,
    phone: input.phone,
    history: input.history,
  })
  return buildReturnPickupAwaitingServiceReply(
    intake,
    input.body,
    input.history
  )
}

export async function runHomAgentTurn(
  conversationId: string,
  turn: UserTurn,
  options?: {
    customerName?: string
    preview?: boolean
    phone?: string
    priorityApiEnabled?: boolean
    onPriorityApiCall?: () => void | Promise<void>
    /** When false, compute reply but do not persist — used while coalescing rapid messages. */
    persistTurn?: boolean
  }
): Promise<AgentResponse> {
  bindPriorityApiBeforeCall(options?.onPriorityApiCall ?? null)
  resetPriorityApiTurnState()
  bindPriorityApiEnabled(
    options?.priorityApiEnabled !== false && !options?.preview
  )
  bindPriorityApiLogContext({
    conversationId,
    whatsappPhone: options?.phone?.trim() || undefined,
  })

  const runtime = await bindRuntimeConfig()
  const body = summarizeTurn(turn)
  const preview = options?.preview
  const persistTurn = options?.persistTurn !== false && !preview
  const phone = options?.phone?.trim() || ""
  const { history, conversationSummary } = await getConversationContext(conversationId)

  bindPriorityApiPreMessageGuard(() =>
    history.some(
      (message) =>
        message.role === "assistant" &&
        isPriorityApiWaitMessage(message.content)
    ) || isOrderConfirmationPending(history)
  )

  beginTurnMetrics(conversationId, runtime.activeProfile, phone)
  setTurnTier(conversationId, "T2")

  const finish = async (result: AgentResponse): Promise<AgentResponse> => {
    const metrics = finishTurnMetrics(conversationId)
    await maybeRefreshConversationSummary({ conversationId, history }).catch(() => {})
    if (metrics) return { ...result, metrics }
    return result
  }

  const preTurn = runPreTurnGuards({
    turn,
    history,
    customerName: options?.customerName,
  })

  if (preTurn.kind === "handled") {
    const action = mapHomAction(preTurn.action)
    maybeScheduleGokuTrainer(conversationId, action)
    if (persistTurn) {
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: preTurn.reply,
        action,
        preview,
      })
    }
    return finish({
      ok: true,
      agent: "faq",
      reply: preTurn.reply,
      action,
      route: ["faq"],
    })
  }

  const structuredOrder = await runStructuredOrderLookupPreTurn({
    turn,
    history,
    phone: phone || undefined,
  })

  if (structuredOrder.kind === "handled") {
    const action = mapHomAction(structuredOrder.action)
    if (persistTurn) {
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: structuredOrder.reply,
        action,
        preview,
      })
    }
    return finish({
      ok: true,
      agent: "faq",
      reply: structuredOrder.reply,
      action,
      route: ["faq"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_structured_order",
      },
    })
  }

  if (
    looksLikeMultipleQuestions(body) &&
    !isOrderConfirmationPending(history) &&
    !isReturnPickupAwaitingThread(history, body)
  ) {
    const questions = await splitOrderedQuestions(body, conversationId).catch(() => [body])
    if (questions.length >= 3) {
      const combinedReply = await answerCombinedQuestions(questions, {
        conversationId,
        history,
        sessionSummary: conversationSummary,
      }).catch(() => "")

      if (combinedReply.trim()) {
        if (persistTurn) {
          await appendTurn({
            conversationId,
            agent: "faq",
            userText: body,
            assistantText: combinedReply,
            action: "reply",
            preview,
          })
        }

        return finish({
          ok: true,
          agent: "faq",
          reply: combinedReply,
          action: "reply",
          route: ["faq"],
          metrics: {
            llm_calls: 1,
            profile: runtime.activeProfile,
            routing_path: "v3_multi_question",
          },
        })
      }
    }
  }

  let output
  let llmCalls = 0
  let model = runtime.profile.faq.model
  let routingPath = "v3"

  const invokeOnce = (modelOverride?: string) =>
    invokeHomAgent({
      conversationId,
      turn,
      history,
      body,
      phone: phone || undefined,
      sessionSummary: conversationSummary,
      modelOverride,
    })

  try {
    const invoked = await invokeOnce()
    output = invoked.output
    llmCalls = invoked.llmCalls
    model = invoked.model
  } catch (error) {
    const canRetry = shouldRetryInvokeAfterFailure(conversationId)
    const gatewayBudgetExceeded = isGatewayBudgetExceeded(error)
    console.error("[hom-agent] invoke failed", {
      conversationId,
      canRetry,
      model,
      gatewayBudgetExceeded,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    if (canRetry && !gatewayBudgetExceeded) {
      const retryModel =
        model !== INVOKE_FALLBACK_MODEL ? INVOKE_FALLBACK_MODEL : undefined
      try {
        const invoked = await invokeOnce(retryModel)
        output = invoked.output
        llmCalls = invoked.llmCalls
        model = invoked.model
        routingPath = retryModel ? "v3_invoke_model_fallback" : "v3_invoke_retry"
      } catch (retryError) {
        console.error("[hom-agent] invoke retry failed", {
          conversationId,
          retryModel: retryModel ?? model,
          error: retryError instanceof Error ? retryError.message : retryError,
        })
        setFallbackLayer(conversationId, "invoke_exception")
        output = {
          reply: buildLlmFailureReply({ gatewayBudgetExceeded }),
          action: "reply" as const,
        }
        llmCalls = 0
      }
    } else {
      setFallbackLayer(
        conversationId,
        gatewayBudgetExceeded ? "gateway_budget" : "invoke_exception"
      )
      output = {
        reply: buildLlmFailureReply({ gatewayBudgetExceeded }),
        action: "reply" as const,
      }
      llmCalls = 0
    }
  }

  const action =
    output.action === "end" && isThanksAcknowledgment(body)
      ? mapHomAction("reply")
      : mapHomAction(output.action)
  const agent = mapHomAgent(output.action)
  const reply = await rebuildReturnPickupServiceReplyIfNeeded({
    reply: output.reply,
    body,
    phone: phone || undefined,
    history,
  })

  if (persistTurn) {
    maybeScheduleGokuTrainer(conversationId, action)
    await appendTurn({
      conversationId,
      agent,
      userText: body,
      assistantText: reply,
      action,
      preview,
    })
  }

  return finish({
    ok: true,
    agent,
    reply,
    action,
    route: [agent],
    metrics: {
      llm_calls: llmCalls,
      models_used: model ? [model] : undefined,
      profile: runtime.activeProfile,
      routing_path: routingPath,
    },
  })
}
