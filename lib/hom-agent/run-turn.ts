import {
  bindPriorityApiBeforeCall,
  bindPriorityApiEnabled,
  bindPriorityApiLogContext,
  bindPriorityApiPreMessageGuard,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import { bindRuntimeConfig } from "@/lib/agent-core/config"
import {
  beginTurnMetrics,
  finishTurnMetrics,
  setTurnTier,
} from "@/lib/agent-core/turn-metrics"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { maybeRefreshConversationSummary } from "@/lib/agents/session-summary"
import {
  buildCarpetRentalPolicyReply,
  buildCreditCodeOnlineHandoffReply,
  buildCreditRedemptionPolicyReply,
  isCarpetRentalQuestion,
  isReturnExchangePolicyFaqQuestion,
  resolveReturnExchangePolicyReply,
} from "@/lib/agents/policy-subjects"
import {
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  buildDissatisfactionRescueReply,
  isDissatisfactionWithoutDefect,
} from "@/lib/agents/dissatisfaction"
import type { AgentResponse, ConversationalAction } from "@/lib/agents/types"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import {
  buildPostPurchaseIntentConfirm,
  buildIntentConfirmDeclinedReply,
  isPostPurchaseIntentConfirmPending,
  isPostPurchaseIntentConfirmed,
  isPostPurchaseIntentDeclined,
} from "@/lib/agents/intent-confirmation"
import {
  classifyPostPurchaseCase,
} from "@/lib/agents/inquiry-intent"
import {
  buildServiceHandoffConfirmReply,
  buildServiceRepHandoffNote,
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  needsServiceSummaryConfirm,
} from "@/lib/agents/service-intake"
import {
  isChannelPhoneSelfReference,
  isOrderConfirmationPending,
  isOrderNumberRequestPending,
  isPhoneLookupConfirmPending,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import { invokeHomAgent } from "@/lib/hom-agent/invoke"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HomAgentAction } from "@/lib/hom-agent/output-schema"
import { validateHomAgentReply } from "@/lib/hom-agent/validate-reply"

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
  const phone = options?.phone?.trim() || ""
  const { history, conversationSummary } = await getConversationContext(conversationId)

  bindPriorityApiPreMessageGuard(() =>
    history.some(
      (message) =>
        message.role === "assistant" &&
        /אני על זה, כמה רגעים/i.test(message.content)
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
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: preTurn.reply,
      action,
      preview,
    })
    return finish({
      ok: true,
      agent: "faq",
      reply: preTurn.reply,
      action,
      route: ["faq"],
    })
  }

  if (isServiceHandoffSummaryPending(history)) {
    if (isServiceHandoffSummaryConfirmed(body)) {
      const intake = extractServiceIntake(history, body)
      const note = buildServiceRepHandoffNote(intake)
      const reply = validateHomAgentReply(
        {
          reply: `${note}\n\nמעולה 🙏 מעבירים עכשיו לנציג שירות שיוכלו לעזור.`,
          action: "human_service",
        },
        body
      ).reply
      await appendTurn({
        conversationId,
        agent: "service",
        userText: body,
        assistantText: reply,
        action: "human_service",
        preview,
      })
      return finish({
        ok: true,
        agent: "service",
        reply,
        action: "human_service",
        route: ["service"],
        metrics: {
          llm_calls: 0,
          profile: runtime.activeProfile,
          routing_path: "v3_t0_service_handoff",
        },
      })
    }
  }

  if (
    isReturnPickupAwaitingThread(history, body) &&
    !isServiceHandoffSummaryPending(history) &&
    !isPostPurchaseIntentConfirmPending(history)
  ) {
    const intake = extractServiceIntake(history, body)
    intake.issueKind = "return_pickup_pending"
    const reply = validateHomAgentReply(
      {
        reply: buildReturnPickupAwaitingServiceReply(intake, body),
        action: "reply",
      },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "service",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "service",
      reply,
      action: "reply",
      route: ["service"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_return_pickup_summary",
      },
    })
  }

  if (isPostPurchaseIntentConfirmPending(history)) {
    if (isPostPurchaseIntentDeclined(body)) {
      const reply = validateHomAgentReply(
        { reply: buildIntentConfirmDeclinedReply(), action: "reply" },
        body
      ).reply
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: reply,
        action: "reply",
        preview,
      })
      return finish({
        ok: true,
        agent: "faq",
        reply,
        action: "reply",
        route: ["faq"],
        metrics: {
          llm_calls: 0,
          profile: runtime.activeProfile,
          routing_path: "v3_t0_intent_declined",
        },
      })
    }

    if (isPostPurchaseIntentConfirmed(body)) {
      const intake = extractServiceIntake(history, body)
      const replyText = needsServiceSummaryConfirm(intake)
        ? buildServiceHandoffConfirmReply(intake)
        : `${buildServiceRepHandoffNote(intake)}\n\nמעבירים לנציג שירות — רגע אחד 🙏`
      const action = needsServiceSummaryConfirm(intake)
        ? ("reply" as const)
        : ("human_service" as const)
      const reply = validateHomAgentReply({ reply: replyText, action }, body).reply
      await appendTurn({
        conversationId,
        agent: "service",
        userText: body,
        assistantText: reply,
        action,
        preview,
      })
      return finish({
        ok: true,
        agent: "service",
        reply,
        action,
        route: ["service"],
        metrics: {
          llm_calls: 0,
          profile: runtime.activeProfile,
          routing_path: "v3_t0_post_purchase_confirm",
        },
      })
    }
  }

  const postPurchaseKind = classifyPostPurchaseCase(body)
  if (
    postPurchaseKind &&
    postPurchaseKind !== "return_pickup_pending" &&
    !isPostPurchaseIntentConfirmPending(history) &&
    !isOrderConfirmationPending(history)
  ) {
    const reply = validateHomAgentReply(
      {
        reply: buildPostPurchaseIntentConfirm(postPurchaseKind, body),
        action: "reply",
      },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "service",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "service",
      reply,
      action: "reply",
      route: ["service"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_post_purchase_intent",
      },
    })
  }

  if (isCreditCodeOnlineRedemptionRequest(body, history)) {
    const reply = validateHomAgentReply(
      { reply: buildCreditCodeOnlineHandoffReply(), action: "human_service" },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "service",
      userText: body,
      assistantText: reply,
      action: "human_service",
      preview,
    })
    return finish({
      ok: true,
      agent: "service",
      reply,
      action: "human_service",
      route: ["service"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_credit_code_online",
      },
    })
  }

  if (isCreditRedemptionQuestion(body)) {
    const reply = validateHomAgentReply(
      { reply: buildCreditRedemptionPolicyReply(), action: "reply" },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "faq",
      reply,
      action: "reply",
      route: ["faq"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_credit_redemption",
      },
    })
  }

  if (isCarpetRentalQuestion(body)) {
    const reply = validateHomAgentReply(
      { reply: buildCarpetRentalPolicyReply(), action: "reply" },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "faq",
      reply,
      action: "reply",
      route: ["faq"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_rental",
      },
    })
  }

  if (isDissatisfactionWithoutDefect(body)) {
    const reply = validateHomAgentReply(
      { reply: buildDissatisfactionRescueReply(), action: "reply" },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "faq",
      reply,
      action: "reply",
      route: ["faq"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_dissatisfaction",
      },
    })
  }

  if (isReturnExchangePolicyFaqQuestion(body)) {
    const reply = validateHomAgentReply(
      { reply: resolveReturnExchangePolicyReply(body), action: "reply" },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "faq",
      reply,
      action: "reply",
      route: ["faq"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_return_exchange_policy",
      },
    })
  }

  if (
    phone &&
    isChannelPhoneSelfReference(body) &&
    (isOrderNumberRequestPending(history) || isPhoneLookupConfirmPending(history))
  ) {
    const reply = validateHomAgentReply(
      {
        reply: await resolveOrderShippingReply({
          body,
          phone,
          history,
        }),
        action: "reply",
      },
      body
    ).reply
    await appendTurn({
      conversationId,
      agent: "service",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return finish({
      ok: true,
      agent: "service",
      reply,
      action: "reply",
      route: ["service"],
      metrics: {
        llm_calls: 0,
        profile: runtime.activeProfile,
        routing_path: "v3_t0_channel_phone",
      },
    })
  }

  let output
  let llmCalls = 0
  let model = runtime.profile.faq.model
  try {
    const invoked = await invokeHomAgent({
      conversationId,
      turn,
      history,
      body,
      phone: phone || undefined,
      sessionSummary: conversationSummary,
    })
    output = invoked.output
    llmCalls = invoked.llmCalls
    model = invoked.model
  } catch (error) {
    console.error("[hom-agent] invoke failed", error)
    output = { reply: buildLlmFailureReply(), action: "reply" as const }
    llmCalls = 0
  }

  const action = mapHomAction(output.action)
  const agent = mapHomAgent(output.action)

  await appendTurn({
    conversationId,
    agent,
    userText: body,
    assistantText: output.reply,
    action,
    preview,
  })

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
      routing_path: "v3",
    },
  })
}
