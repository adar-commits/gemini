import { buildThanksReply, buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import {
  bindOrchestraTier,
  bindRuntimeConfig,
  routerConfig,
  specialistConfig,
} from "@/lib/agent-core/config"
import { safeRunAgent } from "@/lib/agent-core/safe-run-agent"
import {
  beginTurnMetrics,
  finishTurnMetrics,
  setTurnTier,
} from "@/lib/agent-core/turn-metrics"
import { shouldRunDeterministicInterceptors, usesLlmFirstRouting } from "@/lib/agent-core/routing-mode"
import { hasStructuredFlowPending } from "@/lib/agent-core/structured-flow"
import { maybeRefreshConversationSummary } from "@/lib/agents/session-summary"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { appendTurn, getConversationContext } from "@/lib/agents/memory"
import { guessMasterRoute, shouldContinueWithSpecialist, stickySpecialist } from "@/lib/agents/route-intent"
import {
  buildProductInventoryHandoff,
  buildProductUrlReminder,
  isProductSearchFailure,
  buildProductUrlRequest,
  acceptsAsProductReference,
  buildProductHandoffAfterReference,
  hasProductUrl,
  isProductAvailabilityQuestion,
  isProductInventoryQuestion,
  isProductUrlRequestPending,
  isProductHandoffPending,
  isSpecificProductMention,
} from "@/lib/agents/product-handoff"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  isConversationClosing,
  isNonSubstantiveFollowUp,
} from "@/lib/agents/conversation-close"
import { buildDissatisfactionRescueReply, isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import {
  buildWebsiteIssueHandoffOffer,
  isWebsiteIssueComplaint,
  resolveServicePraiseReply,
  shouldHandleServicePraiseFlow,
} from "@/lib/agents/feedback-handling"
import {
  resolvePostPurchaseCaseReply,
  shouldHandlePostPurchaseCaseFlow,
  activePostPurchaseCaseKind,
} from "@/lib/agents/post-purchase-case"
import { isReturnFlowCorrection, isReturnPolicyQuestion, isPreorderDelayComplaint } from "@/lib/agents/inquiry-intent"
import {
  buildDigitalDocumentReply,
  lookupDigitalDocument,
  resolveOrderShippingReply,
  isBotHelpJustDelivered,
  isExplicitHumanRequest,
  isHelpInsufficient,
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  isOrderConfirmationNo,
  isPhoneLookupConfirmPending,
  isAlternatePhoneRequestPending,
  isOrderNumberRequestPending,
  extractOrderNumber,
  extractOrderReference,
  extractPhoneFromText,
  orderLookupEnabled,
} from "@/lib/agents/order-lookup"
import { wasReplyRecentlySent } from "@/lib/agents/reply-dedupe"
import {
  buildHumanHandoffConfirmedReply,
  buildHumanHandoffDeclinedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffPending,
  isOffTopicQuestion,
  OFF_TOPIC_REDIRECT,
} from "@/lib/agents/off-topic"
import {
  buildCustomerServiceTopicPrompt,
  isCustomerServiceOpener,
} from "@/lib/agents/customer-service-opener"
import { isFaqTopicSwitch, isSalesTopicSwitch, isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import {
  buildGreetingReply,
  buildCasualSmallTalkReply,
  hasImmediateBusinessAsk,
  isCasualGreeting,
  isCasualSmallTalk,
  isOpeningTurn,
  shouldWelcomeAfterReset,
} from "@/lib/agents/greeting"
import {
  buildBranchListReply,
  buildBranchReplyForText,
  isBranchListQuestion,
} from "@/lib/agents/branches"
import {
  extractSku,
  isBareSkuMessage,
  isBranchInventoryQuestion,
  isInventoryAvailabilityReply,
  resolveBranchInventoryReply,
  shouldHandleBranchInventory,
} from "@/lib/agents/inventory-lookup"
import {
  breaksPendingHandoff,
  buildStuckHandoffReply,
  isHandoffContextReply,
} from "@/lib/agents/handoff-wait"
import {
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
} from "@/lib/agents/inactivity"
import {
  buildMasterConfusedReply,
  isStrictMisunderstandingReply,
  resolveMasterFallback,
} from "@/lib/agents/master-fallback"
import {
  buildPostConfirmationReply,
  buildSalesIntakeReply,
  isConfirmationPending,
  isSalesConsultationTrigger,
  sanitizeSalesReply,
  shouldUseSalesIntakeFastPath,
  hasOngoingSalesIntake,
} from "@/lib/agents/sales-intake"
import {
  buildShippingPolicyReply,
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import {
  buildCarpetRentalPolicyReply,
  buildReturnExchangePolicyReply,
  matchPolicySubjects,
} from "@/lib/agents/policy-subjects"
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

async function runT0DeterministicPaths(
  conversationId: string,
  turn: UserTurn,
  history: HistoryMessage[],
  route: AgentId[],
  preview: boolean | undefined,
  phone: string,
  sharedOptions: {
    customerName?: string
    preview?: boolean
    phone?: string
    lastAgent: AgentId | null
    lastAction: string | null
    resetAt: string | null
  }
): Promise<AgentResponse | null> {
  const body = summarizeTurn(turn)
  const { lastAgent } = sharedOptions

  if (isCustomerServiceOpener(body)) {
    const reply = normalizeReply("faq", "reply", buildCustomerServiceTopicPrompt())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  if (isDissatisfactionWithoutDefect(body)) {
    return faqDissatisfactionResult(conversationId, body, route, preview)
  }

  if (isReturnPolicyQuestion(body) || isReturnFlowCorrection(body)) {
    return faqReturnPolicyResult(conversationId, body, route, preview, history, lastAgent)
  }

  if (isBranchListQuestion(body)) {
    const reply = normalizeReply(
      "faq",
      "reply",
      finalizeFaqReplyForContext(buildBranchReplyForText(body), history, lastAgent)
    )
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  if (isShippingPolicyQuestion(body)) {
    const reply = normalizeReply(
      "faq",
      "reply",
      finalizeFaqReplyForContext(buildShippingPolicyReply(), history, lastAgent)
    )
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  if (shouldHandlePostPurchaseCaseFlow(body, history)) {
    return postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
  }

  const inventory = await tryBranchInventoryResult(
    conversationId,
    body,
    history,
    route,
    true,
    preview
  )
  if (inventory) return inventory

  if (shouldHandleOrderShippingFlow(body, history)) {
    return shippingResult(conversationId, body, route, preview, phone, history)
  }

  if (isServiceTopicSwitch(body)) {
    return resolveSpecialist(
      conversationId,
      turn,
      "service",
      history,
      true,
      route,
      sharedOptions
    )
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

  return null
}

function normalizeReply(agent: AgentId, action: AgentAction, reply: string) {
  if (agent === "master" || SILENT_ACTIONS.has(action)) return ""

  let trimmed = reply.trim()
  if (!trimmed) return ""

  trimmed = trimmed.replace(/^(?:\*הום בוט :\)\*\n?)+/g, `${CUSTOMER_HEADER}\n`)
  trimmed = trimmed.replace(
    /^הום בוט :\)\s*\n?(?:\*הום בוט :\)\*\n?)?/,
    `${CUSTOMER_HEADER}\n`
  )

  if (trimmed.startsWith(CUSTOMER_HEADER)) return trimmed
  if (trimmed.startsWith("הום בוט :)")) {
    return trimmed.replace(/^הום בוט :\)\s*/, `${CUSTOMER_HEADER}\n`)
  }
  return `${CUSTOMER_HEADER}\n${trimmed}`
}

const FAKE_STOCK_REPLY_RE =
  /אבדוק(?:\s+(?:א(?:ם|ת)|ע(?:ם|ד))?|\s+ב)?(?:מלאי|זמינות)|בודק(?:ים)?\s+(?:ב)?(?:מלאי|זמינות)|(?:יש|קיים)\s+(?:ל(?:כם|נו)\s+)?(?:ב)?(?:מלאי|זמינות)/i

function sanitizeFaqProductReply(body: string, reply: string) {
  if (!reply.trim()) return reply
  if (isInventoryAvailabilityReply(reply)) return reply
  if (isBranchInventoryQuestion(body) || isBareSkuMessage(body)) return reply
  if (
    !isProductInventoryQuestion(body) &&
    !isSpecificProductMention(body) &&
    !FAKE_STOCK_REPLY_RE.test(reply)
  ) {
    return reply
  }
  if (/אין לי גישה|קישור לדף|יועץ מכירות|האם להעביר/i.test(reply)) return reply
  if (isProductInventoryQuestion(body)) return buildProductInventoryHandoff()
  if (hasProductUrl(body)) return buildProductHandoffAfterReference(body)
  return buildProductUrlRequest()
}

function wasSalesFlowActive(history: HistoryMessage[], lastAgent: AgentId | null) {
  return (
    lastAgent === "sales" ||
    hasOngoingSalesIntake(history) ||
    isProductUrlRequestPending(history) ||
    isProductHandoffPending(history)
  )
}

/** After FAQ mid-sales: offer to continue the purchase thread. */
function finalizeFaqReplyForContext(
  reply: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null
) {
  if (!wasSalesFlowActive(history, lastAgent)) return reply
  if (/רוצים\s+להמשיך|להמשיך\s+בבחיר/i.test(reply)) return reply
  const withoutCleanEnding = reply
    .replace(/\n*אפשר לעזור במשהו נוסף\?[^\n]*/i, "")
    .replace(/\n*אם צריך עוד משהו[^\n]*/i, "")
    .trimEnd()
  return `${withoutCleanEnding}\n\nרוצים להמשיך בבחירת השטיח?`
}

export async function runAgent(
  agent: AgentId,
  conversationId: string,
  turn: UserTurn,
  options?: {
    persistUser?: boolean
    history?: HistoryMessage[]
    preview?: boolean
    faqSalesResume?: boolean
    sessionSummary?: string | null
    lastAgent?: AgentId | null
  }
): Promise<AgentResponse> {
  const ctx = options?.history
    ? null
    : await getConversationContext(conversationId)
  const history = options?.history ?? ctx!.history
  const lastAgent = options?.lastAgent ?? ctx?.lastAgent ?? null
  return safeRunAgent(agent, conversationId, turn, {
    persistUser: options?.persistUser,
    history,
    preview: options?.preview,
    faqSalesResume: options?.faqSalesResume,
    sessionSummary: options?.sessionSummary,
    finalizeFaqReply: (reply, hist) =>
      finalizeFaqReplyForContext(reply, hist, lastAgent),
  })
}

async function faqReturnPolicyResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  history?: HistoryMessage[],
  lastAgent?: AgentId | null
): Promise<AgentResponse> {
  const reply = normalizeReply(
    "faq",
    "reply",
    finalizeFaqReplyForContext(buildReturnExchangePolicyReply(), history ?? [], lastAgent ?? null)
  )
  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action: "reply",
    preview,
  })
  return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
}

async function faqDissatisfactionResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean
): Promise<AgentResponse> {
  const reply = normalizeReply("faq", "reply", buildDissatisfactionRescueReply())
  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action: "reply",
    preview,
  })
  return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
}

async function resolveSpecialist(
  conversationId: string,
  turn: UserTurn,
  specialist: AgentId,
  history: HistoryMessage[],
  persistUser: boolean,
  route: AgentId[],
  options?: {
    customerName?: string
    phone?: string
    lastAgent?: AgentId | null
    lastAction?: string | null
    resetAt?: string | null
    preview?: boolean
    sessionSummary?: string | null
  }
): Promise<AgentResponse> {
  route.push(specialist)
  const body = summarizeTurn(turn)
  const userTurns = history.filter((message) => message.role === "user").length
  const preview = options?.preview

  if (isConversationClosing(body) && !isHumanHandoffPending(history)) {
    const reply = buildThanksReply(options?.customerName)
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

  if (isNonSubstantiveFollowUp(body) && !isHumanHandoffPending(history)) {
    const reply = normalizeReply("faq", "reply", buildCasualSmallTalkReply("הלו"))
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

  if (isDissatisfactionWithoutDefect(body)) {
    return faqDissatisfactionResult(conversationId, body, route, preview)
  }

  if (isHumanHandoffPending(history) && isHandoffContextReply(body)) {
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

  if (usesLlmFirstRouting() && !hasStructuredFlowPending(history)) {
    const inventory = await tryBranchInventoryResult(
      conversationId,
      body,
      history,
      route,
      persistUser,
      preview
    )
    if (inventory) return inventory

    if (isSpecialistId(specialist)) {
      const orchestra = bindOrchestraTier({
        body,
        turn,
        history,
        specialist,
      })
      if (orchestra?.tier) setTurnTier(conversationId, orchestra.tier)
    }

    let result = await runAgent(specialist, conversationId, turn, {
      persistUser,
      history,
      preview,
      sessionSummary: options?.sessionSummary,
      lastAgent: options?.lastAgent ?? null,
      faqSalesResume:
        specialist === "faq" &&
        wasSalesFlowActive(history, options?.lastAgent ?? null),
    })

    if (isSpecialistId(result.action) && result.action !== specialist) {
      route.push(result.action)
      result = await runAgent(result.action, conversationId, turn, {
        persistUser: false,
        history,
        preview,
        sessionSummary: options?.sessionSummary,
        lastAgent: options?.lastAgent ?? null,
      })
    }

    if (
      specialist === "sales" &&
      result.reply &&
      FAKE_STOCK_REPLY_RE.test(result.reply)
    ) {
      result = {
        ...result,
        reply: normalizeReply("sales", "reply", buildProductInventoryHandoff()),
      }
    }

    return { ...result, route }
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
    const reply = normalizeReply(agent, "reply", OFF_TOPIC_REDIRECT)
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
    const lastAgent = options?.lastAgent ?? null

    if (matchPolicySubjects(body).includes("carpet_rental")) {
      const reply = normalizeReply(
        replyAgent,
        "reply",
        finalizeFaqReplyForContext(buildCarpetRentalPolicyReply(), history, lastAgent)
      )
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

    if (isShippingPolicyQuestion(body)) {
      const reply = normalizeReply(
        replyAgent,
        "reply",
        finalizeFaqReplyForContext(buildShippingPolicyReply(), history, lastAgent)
      )
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

    const inventory = await tryBranchInventoryResult(
      conversationId,
      body,
      history,
      route,
      persistUser,
      preview
    )
    if (inventory) return inventory

    if (isBranchListQuestion(body)) {
      const reply = normalizeReply(
        replyAgent,
        "reply",
        finalizeFaqReplyForContext(buildBranchReplyForText(body), history, lastAgent)
      )
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
      faqSalesResume: wasSalesFlowActive(history, lastAgent),
    })

    if (isSpecialistId(result.action) && result.action !== replyAgent) {
      route.push(result.action)
      result = await runAgent(result.action, conversationId, turn, {
        persistUser: false,
        history,
        preview,
      })
    }

    if (result.reply) {
      const sanitized = sanitizeFaqProductReply(body, result.reply)
      if (sanitized !== result.reply) {
        result = {
          ...result,
          agent: "sales",
          reply: normalizeReply("sales", "reply", sanitized),
          action: "reply",
        }
      }
    }

    return { ...result, route }
  }

  const inventory = await tryBranchInventoryResult(
    conversationId,
    body,
    history,
    route,
    persistUser,
    preview
  )
  if (inventory) return inventory

  if (isBranchListQuestion(body)) {
    const reply = normalizeReply("faq", "reply", buildBranchReplyForText(body))
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

  if (isProductInventoryQuestion(body)) {
    const reply = normalizeReply("sales", "reply", buildProductInventoryHandoff())
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

  if (isSpecificProductMention(body) && !hasProductUrl(body)) {
    const reply = normalizeReply("sales", "reply", buildProductUrlRequest())
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
    isCasualGreeting(body) &&
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
    const needsSanitize =
      /למי\s+הסלון\s+משמש/i.test(result.reply) ||
      FAKE_STOCK_REPLY_RE.test(result.reply) ||
      isStrictMisunderstandingReply(result.reply)
    if (needsSanitize) {
      const sanitized =
        isInventoryAvailabilityReply(result.reply)
          ? result.reply
          : FAKE_STOCK_REPLY_RE.test(result.reply)
        ? buildProductInventoryHandoff()
        : isStrictMisunderstandingReply(result.reply)
          ? shouldUseSalesIntakeFastPath(body, history, options?.lastAgent ?? null)
            ? buildSalesIntakeReply(history, body)
            : buildMasterConfusedReply()
          : sanitizeSalesReply(result.reply, history, body)
      result = { ...result, reply: normalizeReply("sales", "reply", sanitized) }
    }
  }

  if (specialist === "faq" && result.reply && isStrictMisunderstandingReply(result.reply)) {
    result = {
      ...result,
      reply: normalizeReply("faq", "reply", buildMasterConfusedReply()),
      action: "reply",
    }
  }

  if (specialist === "faq" && result.reply) {
    const sanitized = sanitizeFaqProductReply(body, result.reply)
    if (sanitized !== result.reply) {
      result = {
        ...result,
        agent: "sales",
        reply: normalizeReply("sales", "reply", sanitized),
        action: "reply",
      }
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

  if (
    !result.reply &&
    (result.action === "reply" ||
      (isHumanHandoffPending(history) && !breaksPendingHandoff(body)))
  ) {
    const reply = normalizeReply(
      specialist === "master" ? "faq" : specialist,
      "reply",
      buildStuckHandoffReply()
    )
    await appendTurn({
      conversationId,
      agent: specialist === "master" ? "faq" : specialist,
      userText: body,
      assistantText: reply,
      action: "reply",
      persistUser,
      preview,
    })
    return { ...result, agent: "faq", reply, action: "reply", route }
  }

  if (
    options?.phone &&
    orderLookupEnabled() &&
    (result.action === "receipt" ||
      result.action === "invoice_tax" ||
      result.action === "invoice_tax_receipt")
  ) {
    const link = await lookupDigitalDocument(options.phone)
    if (link) {
      result = {
        ...result,
        reply: normalizeReply("service", "reply", buildDigitalDocumentReply(link)),
      }
    }
  }

  return { ...result, route }
}

function shouldHandleBranchInventoryFlow(body: string, history: HistoryMessage[]) {
  if (shouldHandleBranchInventory(body, history)) return true
  if (extractSku(body) && isProductUrlRequestPending(history)) return true
  return false
}

async function tryBranchInventoryResult(
  conversationId: string,
  body: string,
  history: HistoryMessage[],
  route: AgentId[],
  persistUser: boolean,
  preview?: boolean
): Promise<AgentResponse | null> {
  if (!shouldHandleBranchInventoryFlow(body, history)) return null

  const reply = normalizeReply(
    "sales",
    "reply",
    await resolveBranchInventoryReply({ body, history })
  )

  if (wasReplyRecentlySent(history, reply)) {
    return {
      ok: true,
      agent: "sales",
      reply: "",
      action: "reply",
      route: [...route, "sales"],
    }
  }

  const { assistantInserted } = await appendTurn({
    conversationId,
    agent: "sales",
    userText: body,
    assistantText: reply,
    action: "reply",
    persistUser,
    preview,
  })

  return {
    ok: true,
    agent: "sales",
    reply: assistantInserted ? reply : "",
    action: "reply",
    route: [...route, "sales"],
  }
}

function shouldHandleOrderShippingFlow(body: string, history: HistoryMessage[]) {
  if (shouldHandleServicePraiseFlow(body, history)) return false
  if (shouldHandlePostPurchaseCaseFlow(body, history)) return false
  if (isPreorderDelayComplaint(body)) return false
  if (shouldHandleBranchInventory(body, history)) return false

  if (
    isOrderNumberRequestPending(history) ||
    isAlternatePhoneRequestPending(history) ||
    isPhoneLookupConfirmPending(history) ||
    isOrderConfirmationPending(history)
  ) {
    return true
  }

  if (extractOrderReference(body)) return true

  if (
    extractPhoneFromText(body) &&
    (isPhoneLookupConfirmPending(history) || isOrderNumberRequestPending(history))
  ) {
    return true
  }

  return isShippingStatusQuestion(body)
}

function shippingResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  phone?: string,
  history?: HistoryMessage[]
): Promise<AgentResponse> {
  return resolveShippingStatusReply(body, phone, history).then(async (reply) => {
    if (wasReplyRecentlySent(history ?? [], reply)) {
      return {
        ok: true,
        agent: "master" as const,
        reply: "",
        action: "shipping" as const,
        route,
      }
    }

    const { assistantInserted } = await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: reply,
      action: "shipping",
      preview,
    })

    return {
      ok: true,
      agent: "master" as const,
      reply: assistantInserted ? reply : "",
      action: "shipping" as const,
      route,
    }
  })
}

async function resolveShippingStatusReply(
  body: string,
  phone?: string,
  history?: HistoryMessage[]
) {
  return resolveOrderShippingReply({ body, phone, history })
}

function postPurchaseCaseResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  phone?: string,
  history?: HistoryMessage[]
): Promise<AgentResponse> {
  return resolvePostPurchaseCaseReply({ body, phone, history }).then(async (reply) => {
    if (wasReplyRecentlySent(history ?? [], reply)) {
      return {
        ok: true,
        agent: "master" as const,
        reply: "",
        action: "reply" as const,
        route,
      }
    }

    const { assistantInserted } = await appendTurn({
      conversationId,
      agent: "service",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })

    return {
      ok: true,
      agent: "service" as const,
      reply: assistantInserted ? reply : "",
      action: "reply" as const,
      route: [...route, "service"],
    }
  })
}

function servicePraiseResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  phone?: string,
  history?: HistoryMessage[]
): Promise<AgentResponse> {
  return resolveServicePraiseReply({ body, phone, history }).then(async (reply) => {
    if (wasReplyRecentlySent(history ?? [], reply)) {
      return {
        ok: true,
        agent: "master" as const,
        reply: "",
        action: "reply" as const,
        route,
      }
    }

    const { assistantInserted } = await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })

    return {
      ok: true,
      agent: "faq" as const,
      reply: assistantInserted ? reply : "",
      action: "reply" as const,
      route: [...route, "faq"],
    }
  })
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
  if (!isCasualGreeting(body)) return null
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

async function tryCasualSmallTalk(
  conversationId: string,
  turn: UserTurn,
  history: HistoryMessage[],
  options?: { preview?: boolean; handoffPending?: boolean }
): Promise<AgentResponse | null> {
  const body = summarizeTurn(turn)
  if (!isCasualSmallTalk(body)) return null

  const reply = buildCasualSmallTalkReply(body, options?.handoffPending ?? false)
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

async function routeViaMasterLlm(
  conversationId: string,
  turn: UserTurn,
  history: HistoryMessage[],
  route: AgentId[],
  preview: boolean | undefined,
  phone: string,
  sharedOptions: {
    customerName?: string
    preview?: boolean
    phone?: string
    lastAgent: AgentId | null
    lastAction: string | null
    resetAt: string | null
    sessionSummary?: string | null
  }
): Promise<AgentResponse> {
  const body = summarizeTurn(turn)
  const { lastAgent, lastAction, sessionSummary } = sharedOptions

  const guessed = guessMasterRoute(body)
  if (guessed) {
    route.push("master")
    const next = MASTER_ROUTE_MAP[guessed] ?? "faq"
    if (next === "shipping") {
      return shippingResult(conversationId, body, route, preview, phone || undefined, history)
    }
    return resolveSpecialist(
      conversationId,
      turn,
      next,
      history,
      true,
      route,
      { ...sharedOptions, sessionSummary }
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
      { ...sharedOptions, sessionSummary }
    )
  }

  const masterFallback = resolveMasterFallback(body, history, lastAgent)
  if (masterFallback?.kind === "sales_intake") {
    return resolveSpecialist(
      conversationId,
      turn,
      "sales",
      history,
      true,
      route,
      { ...sharedOptions, sessionSummary }
    )
  }
  if (masterFallback?.kind === "handoff_offer") {
    const reply = normalizeReply("faq", "reply", buildMasterConfusedReply())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  const master = await runAgent("master", conversationId, turn, {
    history,
    preview,
    sessionSummary,
    lastAgent,
  })
  route.push("master")
  const masterAction = (
    MASTER_ROUTE_MAP[master.action as MasterAction]
      ? master.action
      : "ROUTE_TO_INFO_AGENT"
  ) as MasterAction
  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") {
    return shippingResult(conversationId, body, route, preview, phone || undefined, history)
  }
  return resolveSpecialist(
    conversationId,
    turn,
    next,
    history,
    true,
    route,
    sharedOptions
  )
}

export async function runMasterConversation(
  conversationId: string,
  turn: UserTurn,
  options?: { customerName?: string; preview?: boolean; phone?: string }
): Promise<AgentResponse> {
  const runtime = await bindRuntimeConfig()
  beginTurnMetrics(conversationId, runtime.activeProfile)

  const body = summarizeTurn(turn)
  const { history, lastAgent, lastAction, resetAt, conversationSummary } =
    await getConversationContext(conversationId)
  const route: AgentId[] = []
  const preview = options?.preview
  const phone = options?.phone?.trim() || ""
  let sharedOptions: {
    customerName?: string
    preview?: boolean
    phone?: string
    lastAgent: AgentId | null
    lastAction: string | null
    resetAt: string | null
    sessionSummary?: string | null
  } = {
    ...options,
    lastAgent,
    lastAction,
    resetAt,
    preview,
    phone: phone || undefined,
    sessionSummary: conversationSummary,
  }

  const finish = async (result: AgentResponse): Promise<AgentResponse> => {
    const metrics = finishTurnMetrics(conversationId)
    await maybeRefreshConversationSummary({ conversationId, history }).catch(() => {})
    if (metrics) {
      return { ...result, metrics }
    }
    return result
  }

  if (isWhatsappAutoresponder(body)) {
    await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: "",
      action: "end",
      preview,
    })
    return { ok: true, agent: "master", reply: "", action: "end", route }
  }

  if (isInactivityPingPending(history) && isInactivityStillHereReply(body)) {
    if (
      activePostPurchaseCaseKind(history) ||
      isPhoneLookupConfirmPending(history) ||
      isOrderConfirmationPending(history) ||
      isAlternatePhoneRequestPending(history) ||
      shouldHandlePostPurchaseCaseFlow(body, history)
    ) {
      return postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
    }

    if (shouldHandleOrderShippingFlow(body, history)) {
      return shippingResult(conversationId, body, route, preview, phone, history)
    }

    const reply = normalizeReply(
      "faq",
      "reply",
      buildInactivityStillHereAck(options?.customerName)
    )
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  if (isConversationClosing(body) && !isHumanHandoffPending(history)) {
    const reply = buildThanksReply(options?.customerName)
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  if (isNonSubstantiveFollowUp(body) && !isHumanHandoffPending(history)) {
    const reply = normalizeReply("faq", "reply", buildCasualSmallTalkReply("הלו"))
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
  }

  const structuredFlow = hasStructuredFlowPending(history)

  if (usesLlmFirstRouting() && !structuredFlow) {
    const welcome = await tryWelcomeGreeting(
      conversationId,
      turn,
      { history, lastAction, resetAt },
      options
    )
    if (welcome) return welcome

    const casual = await tryCasualSmallTalk(conversationId, turn, history, {
      preview,
      handoffPending: isHumanHandoffPending(history),
    })
    if (casual) return finish(casual)

    const t0 = await runT0DeterministicPaths(
      conversationId,
      turn,
      history,
      route,
      preview,
      phone,
      sharedOptions
    )
    if (t0) return finish(t0)

    return finish(
      await routeViaMasterLlm(
        conversationId,
        turn,
        history,
        route,
        preview,
        phone,
        sharedOptions
      )
    )
  }

  if (
    isBotHelpJustDelivered(history) &&
    (isExplicitHumanRequest(body) || isHelpInsufficient(body))
  ) {
    const action = inferHumanHandoffAction(history, lastAgent)
    const reply = `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply(action)}`
    await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: reply,
      action,
      preview,
    })
    return { ok: true, agent: "master", reply, action, route: [...route, "master"] }
  }

  const welcome = await tryWelcomeGreeting(
    conversationId,
    turn,
    { history, lastAction, resetAt },
    options
  )
  if (welcome) return welcome

  const casual = await tryCasualSmallTalk(conversationId, turn, history, {
    preview,
    handoffPending: isHumanHandoffPending(history),
  })
  if (casual) return casual

  if (isHumanHandoffPending(history) && breaksPendingHandoff(body)) {
    const next = isServiceTopicSwitch(body)
      ? ("service" as const)
      : isSalesTopicSwitch(body)
        ? ("sales" as const)
        : ("faq" as const)
    return resolveSpecialist(
      conversationId,
      turn,
      next,
      history,
      true,
      route,
      sharedOptions
    )
  }

  if (isHumanHandoffPending(history) && isHandoffContextReply(body)) {
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

  if (isHumanHandoffPending(history) && !breaksPendingHandoff(body)) {
    const agent =
      lastAgent && isSpecialistId(lastAgent) ? lastAgent : ("faq" as const)
    const reply = normalizeReply(agent, "reply", buildStuckHandoffReply())
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

  if (shouldRunDeterministicInterceptors(structuredFlow)) {
    if (isCustomerServiceOpener(body)) {
      const reply = normalizeReply("faq", "reply", buildCustomerServiceTopicPrompt())
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: reply,
        action: "reply",
        preview,
      })
      return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
    }

    if (isWebsiteIssueComplaint(body)) {
      const reply = normalizeReply("faq", "reply", buildWebsiteIssueHandoffOffer())
      await appendTurn({
        conversationId,
        agent: "faq",
        userText: body,
        assistantText: reply,
        action: "reply",
        preview,
      })
      return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
    }

    if (isDissatisfactionWithoutDefect(body)) {
      return faqDissatisfactionResult(conversationId, body, route, preview)
    }

  if (shouldHandleServicePraiseFlow(body, history)) {
    return servicePraiseResult(conversationId, body, route, preview, phone, history)
  }

  if (isReturnPolicyQuestion(body) || isReturnFlowCorrection(body)) {
    return faqReturnPolicyResult(conversationId, body, route, preview, history, lastAgent)
  }

  if (shouldHandlePostPurchaseCaseFlow(body, history)) {
    return postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
  }

  const inventory = await tryBranchInventoryResult(
    conversationId,
    body,
    history,
    route,
    true,
    preview
  )
  if (inventory) return inventory

  if (shouldHandleOrderShippingFlow(body, history)) {
    return shippingResult(conversationId, body, route, preview, phone, history)
  }

  if (isServiceTopicSwitch(body)) {
    return resolveSpecialist(
      conversationId,
      turn,
      "service",
      history,
      true,
      route,
      sharedOptions
    )
  }

  if (isShippingPolicyQuestion(body)) {
    const reply = normalizeReply("faq", "reply", buildShippingPolicyReply())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
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

  if (
    shouldUseSalesIntakeFastPath(body, history, lastAgent) ||
    (isSalesConsultationTrigger(body) && !isProductAvailabilityQuestion(body))
  ) {
    return resolveSpecialist(
      conversationId,
      turn,
      "sales",
      history,
      true,
      route,
      sharedOptions
    )
  }

  if (isProductUrlRequestPending(history) && !breaksPendingHandoff(body)) {
    if (extractSku(body)) {
      const inventoryAfterUrl = await tryBranchInventoryResult(
        conversationId,
        body,
        history,
        route,
        true,
        preview
      )
      if (inventoryAfterUrl) return inventoryAfterUrl
    }
    const agent =
      lastAgent && isSpecialistId(lastAgent) ? lastAgent : ("sales" as const)
    const reply = normalizeReply(
      agent,
      "reply",
      hasProductUrl(body) || acceptsAsProductReference(body)
        ? buildProductHandoffAfterReference(body)
        : isProductInventoryQuestion(body) || isProductSearchFailure(body)
          ? buildProductInventoryHandoff()
          : buildProductUrlReminder()
    )
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

  if (isProductInventoryQuestion(body)) {
    const reply = normalizeReply("sales", "reply", buildProductInventoryHandoff())
    await appendTurn({
      conversationId,
      agent: "sales",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "sales", reply, action: "reply", route: [...route, "sales"] }
  }

  if (isSpecificProductMention(body) && !hasProductUrl(body)) {
    const reply = normalizeReply("sales", "reply", buildProductUrlRequest())
    await appendTurn({
      conversationId,
      agent: "sales",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "sales", reply, action: "reply", route: [...route, "sales"] }
  }

  if (isSpecificProductMention(body) && hasProductUrl(body)) {
    const reply = normalizeReply("sales", "reply", buildProductHandoffAfterReference(body))
    await appendTurn({
      conversationId,
      agent: "sales",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "sales", reply, action: "reply", route: [...route, "sales"] }
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
  }

  const masterFallback = resolveMasterFallback(body, history, lastAgent)
  if (masterFallback?.kind === "sales_intake") {
    return resolveSpecialist(
      conversationId,
      turn,
      "sales",
      history,
      true,
      route,
      sharedOptions
    )
  }
  if (masterFallback?.kind === "handoff_offer") {
    const reply = normalizeReply("faq", "reply", buildMasterConfusedReply())
    await appendTurn({
      conversationId,
      agent: "faq",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview,
    })
    return { ok: true, agent: "faq", reply, action: "reply", route: [...route, "faq"] }
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

  const guessed = usesLlmFirstRouting() ? null : guessMasterRoute(body)
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
    const master = await runAgent("master", conversationId, turn, {
      history,
      preview,
    })
    route.push("master")
    masterAction = (MASTER_ROUTE_MAP[master.action as MasterAction]
      ? master.action
      : "ROUTE_TO_INFO_AGENT") as MasterAction
  }

  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") {
    return shippingResult(conversationId, body, route, preview, phone || undefined, history)
  }

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
