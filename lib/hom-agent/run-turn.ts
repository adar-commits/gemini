import {
  bindPriorityApiBeforeCall,
  bindPriorityApiEnabled,
  bindPriorityApiLogContext,
  bindPriorityApiPreMessageGuard,
  isPriorityApiWaitMessage,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
import {
  beginTurnMetrics,
  finishTurnMetrics,
  setFallbackLayer,
  setTurnTier,
} from "@/lib/agent-core/turn-metrics"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { maybeRefreshConversationSummary } from "@/lib/agents/session-summary"
import { isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { isOrderConfirmationPending } from "@/lib/agents/order-lookup"
import type { AgentResponse, ConversationalAction } from "@/lib/agents/types"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { invokeHomAgent } from "@/lib/hom-agent/invoke"
import { shouldRetryInvokeAfterFailure } from "@/lib/hom-agent/invoke-retry"
import { runPreTurnGuards, runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HomAgentAction } from "@/lib/hom-agent/output-schema"

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

  let output
  let llmCalls = 0
  let model = runtime.profile.faq.model
  let routingPath = "v3"

  const invokeOnce = () =>
    invokeHomAgent({
      conversationId,
      turn,
      history,
      body,
      phone: phone || undefined,
      sessionSummary: conversationSummary,
    })

  try {
    const invoked = await invokeOnce()
    output = invoked.output
    llmCalls = invoked.llmCalls
    model = invoked.model
  } catch (error) {
    const canRetry = shouldRetryInvokeAfterFailure(conversationId, body)
    console.error("[hom-agent] invoke failed", {
      conversationId,
      canRetry,
      error: error instanceof Error ? error.message : error,
    })

    if (canRetry) {
      try {
        const invoked = await invokeOnce()
        output = invoked.output
        llmCalls = invoked.llmCalls
        model = invoked.model
        routingPath = "v3_invoke_retry"
      } catch (retryError) {
        console.error("[hom-agent] invoke retry failed", {
          conversationId,
          error: retryError instanceof Error ? retryError.message : retryError,
        })
        setFallbackLayer(conversationId, "invoke_exception")
        output = { reply: buildLlmFailureReply(), action: "reply" as const }
        llmCalls = 0
      }
    } else {
      setFallbackLayer(conversationId, "invoke_exception")
      output = { reply: buildLlmFailureReply(), action: "reply" as const }
      llmCalls = 0
    }
  }

  const action =
    output.action === "end" && isThanksAcknowledgment(body)
      ? mapHomAction("reply")
      : mapHomAction(output.action)
  const agent = mapHomAgent(output.action)

  if (persistTurn) {
    await appendTurn({
      conversationId,
      agent,
      userText: body,
      assistantText: output.reply,
      action,
      preview,
    })
  }

  return finish({
    ok: true,
    agent,
    reply: output.reply,
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
