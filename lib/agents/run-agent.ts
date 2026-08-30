import {
  bindPriorityApiBeforeCall,
  bindPriorityApiEnabled,
  bindPriorityApiLogContext,
  bindPriorityApiPreMessageGuard,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
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
  setRoutingPath,
  setTurnTier,
} from "@/lib/agent-core/turn-metrics"
import { confidentSkipMasterRoute } from "@/lib/agent-core/confident-route"
import { logRouteDisagreement } from "@/lib/agent-core/route-disagreement"
import { shouldRunDeterministicInterceptors, usesLlmFirstRouting } from "@/lib/agent-core/routing-mode"
import { hasStructuredFlowPending } from "@/lib/agent-core/structured-flow"
import { maybeRefreshConversationSummary } from "@/lib/agents/session-summary"
import { summarizeTurn, type UserTurn } from "@/lib/agents/user-turn"
import { appendTurn, appendMultiReplyTurn, getConversationContext } from "@/lib/agents/memory"
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
import {
  buildDissatisfactionRescueReply,
  buildDissatisfactionRescuePortalReply,
  getDissatisfactionRescueStage,
  isDissatisfactionWithoutDefect,
  resolveDissatisfactionRescueFollowUp,
} from "@/lib/agents/dissatisfaction"
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
  resolveDigitalDocumentFlowReply,
  shouldHandleDigitalDocumentFlow,
  isDigitalDocumentRequest,
} from "@/lib/agents/digital-document-flow"
import {
  buildOrderLookupApiFailureReply,
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
  isHumanHandoffPending,
  isOffTopicQuestion,
  OFF_TOPIC_REDIRECT,
} from "@/lib/agents/off-topic"
import {
  isPureHandoffAffirmation,
  isPureHandoffDecline,
  isHandoffAffirmationWithExtra,
  isPureInactivityAck,
  isInactivityAckWithExtra,
  isFinalizationQuestion,
  isConfirmationAffirmationWithExtra,
  buildHandoffResumeOffer,
  buildConfirmationResumeOffer,
  replyAwaitingCustomerInput,
  hasEmbeddedBusinessAsk,
  remainderAfterLeadingAffirmation,
} from "@/lib/agents/compound-reply"
import {
  answerCombinedQuestions,
  answerFaqQuestionDeterministic,
  answerFaqQuestionWithLlm,
  looksLikeMultipleQuestions,
  splitOrderedQuestions,
} from "@/lib/agents/multi-question"
import {
  buildPostHandoffFooter,
  isPostHumanHandoff,
  postHandoffKind,
} from "@/lib/agents/post-handoff"
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
  isSelfContainedGreetingReply,
  shouldWelcomeAfterReset,
} from "@/lib/agents/greeting"
import {
  buildBranchListReply,
  buildBranchReplyForText,
  isBranchListQuestion,
  isReturnToBranchQuestion,
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
  isInactivityPingPending,
  isInactivityStillHereReply,
  lastNonInactivityAssistantText,
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
  isSalesPhotoRequestPending,
  turnHasCustomerImage,
  isActiveSalesConsultation,
  blocksOrderLookupForSalesConsultation,
  isAwaitingSalesIntakeAnswer,
  buildSalesPhotoReceivedReply,
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

function markT0Routing(conversationId: string, result: AgentResponse): AgentResponse {
  setRoutingPath(conversationId, "t0")
  return result
}

function branchReplyForTurn(body: string, history: HistoryMessage[]) {
  const returnContext =
    isReturnToBranchQuestion(body) ||
    (getDissatisfactionRescueStage(history) === "portal_referred" &&
      /סניף|סניפ/i.test(body))
  return buildBranchReplyForText(body, { returnContext })
}

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
    return markT0Routing(conversationId, {
      ok: true,
      agent: "faq",
      reply,
      action: "reply",
      route: [...route, "faq"],
    })
  }

  if (isDissatisfactionWithoutDefect(body)) {
    return markT0Routing(
      conversationId,
      await faqDissatisfactionResult(conversationId, body, route, preview)
    )
  }

  if (isReturnPolicyQuestion(body) || isReturnFlowCorrection(body)) {
    return markT0Routing(
      conversationId,
      await faqReturnPolicyResult(
        conversationId,
        body,
        route,
        preview,
        history,
        lastAgent
      )
    )
  }

  const inventoryEarly = await tryBranchInventoryResult(
    conversationId,
    body,
    history,
    route,
    true,
    preview
  )
  if (inventoryEarly) return markT0Routing(conversationId, inventoryEarly)

  if (isBranchListQuestion(body)) {
    return markT0Routing(
      conversationId,
      await faqPendingFlowResult(
        conversationId,
        body,
        branchReplyForTurn(body, history),
        history,
        sharedOptions.lastAgent,
        route,
        { preview }
      )
    )
  }

  if (isShippingPolicyQuestion(body)) {
    return markT0Routing(
      conversationId,
      await faqPendingFlowResult(
        conversationId,
        body,
        buildShippingPolicyReply(),
        history,
        sharedOptions.lastAgent,
        route,
        { preview }
      )
    )
  }

  if (
    turnHasCustomerImage(turn) &&
    isSalesPhotoRequestPending(history) &&
    isActiveSalesConsultation(history, sharedOptions.lastAgent)
  ) {
    return markT0Routing(
      conversationId,
      await salesPhotoUploadResult(conversationId, body, route, preview, history)
    )
  }

  if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
    return markT0Routing(
      conversationId,
      await documentFlowResult(conversationId, body, route, preview, phone, history)
    )
  }

  if (shouldHandlePostPurchaseCaseFlow(body, history, sharedOptions.lastAgent)) {
    return markT0Routing(
      conversationId,
      await postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
    )
  }

  if (
    shouldUseSalesIntakeFastPath(body, history, sharedOptions.lastAgent) ||
    (isSalesConsultationTrigger(body) && !isProductAvailabilityQuestion(body)) ||
    isSalesTopicSwitch(body)
  ) {
    return markT0Routing(
      conversationId,
      await resolveSpecialist(
        conversationId,
        turn,
        "sales",
        history,
        true,
        route,
        sharedOptions
      )
    )
  }

  if (shouldHandleOrderShippingFlow(body, history, sharedOptions.lastAgent)) {
    return markT0Routing(
      conversationId,
      await shippingResult(conversationId, body, route, preview, phone, history)
    )
  }

  if (isServiceTopicSwitch(body) && !shouldHandleDigitalDocumentFlow(body, history)) {
    return markT0Routing(
      conversationId,
      await resolveSpecialist(
        conversationId,
        turn,
        "service",
        history,
        true,
        route,
        sharedOptions
      )
    )
  }

  if (isFaqTopicSwitch(body)) {
    return markT0Routing(
      conversationId,
      await resolveSpecialist(
        conversationId,
        turn,
        "faq",
        history,
        true,
        route,
        sharedOptions
      )
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
  if (isSelfContainedGreetingReply(trimmed)) {
    return trimmed.replace(/^(?:\*הום בוט :\)\*\n?)+/, "").trim()
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

/** Answer side questions during handoff / confirmation, then close the loop. */
function finalizeReplyForPendingFlow(
  reply: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null,
  body: string
): { text: string; replies?: string[]; action?: AgentAction } {
  if (replyAwaitingCustomerInput(reply)) {
    return { text: reply }
  }

  if (isInactivityPingPending(history) && isInactivityAckWithExtra(body)) {
    return { text: reply.trimEnd() }
  }

  if (isHumanHandoffPending(history) && isHandoffAffirmationWithExtra(body)) {
    const action = inferHumanHandoffAction(history, lastAgent)
    const stripped = reply
      .replace(/\n*אפשר לעזור במשהו נוסף\?[^\n]*/i, "")
      .replace(/\n*אם צריך עוד משהו[^\n]*/i, "")
      .trimEnd()
    return {
      text: stripped,
      replies: [stripped, buildHumanHandoffConfirmedReply(action)],
      action,
    }
  }

  if (
    isHumanHandoffPending(history) &&
    breaksPendingHandoff(body) &&
    !isHandoffAffirmationWithExtra(body)
  ) {
    const stripped = reply.trimEnd()
    if (/להמשיך\s+עם\s+העברה\s+ליועץ/i.test(stripped)) return { text: reply }
    return { text: `${stripped}\n\n${buildHandoffResumeOffer()}` }
  }

  if (isConfirmationPending(history) && isConfirmationAffirmationWithExtra(body)) {
    const stripped = reply.trimEnd()
    return { text: `${stripped}\n\n${buildConfirmationResumeOffer()}` }
  }

  return { text: finalizeFaqReplyForContext(reply, history, lastAgent) }
}

function applyPendingFlowFinalization(
  agent: AgentId,
  baseReply: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null,
  body: string
) {
  const finalized = finalizeReplyForPendingFlow(baseReply, history, lastAgent, body)
  const action = finalized.action ?? "reply"
  const parts = finalized.replies ?? [finalized.text]
  const replies = parts.map((part) => normalizeReply(agent, action, part))
  return {
    reply: replies[0] ?? "",
    replies: replies.length > 1 ? replies : undefined,
    action,
  }
}

async function persistAgentReplies(input: {
  conversationId: string
  agent: AgentId
  userText: string
  replies: string[]
  action: AgentAction
  persistUser?: boolean
  preview?: boolean
}) {
  if (input.replies.length <= 1) {
    await appendTurn({
      conversationId: input.conversationId,
      agent: input.agent,
      userText: input.userText,
      assistantText: input.replies[0] ?? "",
      action: input.action,
      persistUser: input.persistUser,
      preview: input.preview,
    })
    return
  }
  await appendMultiReplyTurn({
    conversationId: input.conversationId,
    agent: input.agent,
    userText: input.userText,
    assistantTexts: input.replies,
    action: input.action,
    persistUser: input.persistUser,
    preview: input.preview,
  })
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
    postProcessReply: (reply, hist, userBody) =>
      finalizeReplyForPendingFlow(reply, hist, lastAgent, userBody),
  })
}

async function faqPendingFlowResult(
  conversationId: string,
  body: string,
  baseReply: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null,
  route: AgentId[],
  options?: { persistUser?: boolean; preview?: boolean }
): Promise<AgentResponse> {
  const { reply, replies, action } = applyPendingFlowFinalization(
    "faq",
    baseReply,
    history,
    lastAgent,
    body
  )
  const outbound = replies ?? (reply ? [reply] : [])
  await persistAgentReplies({
    conversationId,
    agent: "faq",
    userText: body,
    replies: outbound,
    action,
    persistUser: options?.persistUser,
    preview: options?.preview,
  })
  return {
    ok: true,
    agent: "faq",
    reply,
    replies,
    action,
    route: [...route, "faq"],
  }
}

async function resolveMultiQuestionTurn(
  conversationId: string,
  body: string,
  history: HistoryMessage[],
  route: AgentId[],
  sharedOptions: {
    lastAction: string | null
    sessionSummary?: string | null
    preview?: boolean
  },
  goal?: { reply: string; action?: AgentAction }
): Promise<AgentResponse | null> {
  if (!looksLikeMultipleQuestions(body)) return null

  const questions = await splitOrderedQuestions(body, conversationId)
  if (questions.length < 2) return null

  bindOrchestraTier({
    body,
    turn: { text: body, media: [] },
    history,
    specialist: "faq",
  })

  setRoutingPath(conversationId, "multi_combined")

  let combined = await answerCombinedQuestions(questions, {
    conversationId,
    history,
    sessionSummary: sharedOptions.sessionSummary,
  })

  const postKind = isPostHumanHandoff(sharedOptions.lastAction, history)
    ? postHandoffKind(sharedOptions.lastAction, history)
    : null
  if (postKind && combined) {
    if (!/היועץ כבר קיבל|הנציג כבר קיבל/i.test(combined)) {
      combined = `${combined}\n\n${buildPostHandoffFooter(postKind)}`
    }
  }

  if (goal?.reply) {
    combined = combined ? `${combined}\n\n${goal.reply}` : goal.reply
  }

  const action = goal?.action ?? "reply"
  const reply = normalizeReply("faq", action, combined)
  if (!reply) return null

  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action,
    preview: sharedOptions.preview,
  })

  return {
    ok: true,
    agent: "faq",
    reply,
    action,
    route: [...route, "faq"],
  }
}

async function resolvePostHandoffFaqTurn(
  conversationId: string,
  body: string,
  history: HistoryMessage[],
  route: AgentId[],
  sharedOptions: {
    lastAction: string | null
    preview?: boolean
  }
): Promise<AgentResponse | null> {
  if (!isPostHumanHandoff(sharedOptions.lastAction, history)) return null
  if (!hasEmbeddedBusinessAsk(body)) return null

  if (shouldHandleBranchInventory(body, history)) {
    const reply = normalizeReply(
      "sales",
      "reply",
      await resolveBranchInventoryReply({ body, history })
    )
    await appendTurn({
      conversationId,
      agent: "sales",
      userText: body,
      assistantText: reply,
      action: "reply",
      preview: sharedOptions.preview,
    })
    return {
      ok: true,
      agent: "sales",
      reply,
      action: "reply",
      route: [...route, "sales"],
    }
  }

  const answer = answerFaqQuestionDeterministic(body)
  if (!answer) return null

  const kind = postHandoffKind(sharedOptions.lastAction, history)
  const text =
    kind && !/היועץ כבר קיבל|הנציג כבר קיבל/i.test(answer)
      ? `${answer}\n\n${buildPostHandoffFooter(kind)}`
      : answer
  const reply = normalizeReply("faq", "reply", text)

  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action: "reply",
    preview: sharedOptions.preview,
  })

  return {
    ok: true,
    agent: "faq",
    reply,
    action: "reply",
    route: [...route, "faq"],
  }
}

async function faqReturnPolicyResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  history?: HistoryMessage[],
  lastAgent?: AgentId | null
): Promise<AgentResponse> {
  return faqPendingFlowResult(
    conversationId,
    body,
    buildReturnExchangePolicyReply(),
    history ?? [],
    lastAgent ?? null,
    route,
    { preview }
  )
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

async function dissatisfactionRescueFollowUpResult(
  conversationId: string,
  body: string,
  history: HistoryMessage[],
  route: AgentId[],
  preview?: boolean
): Promise<AgentResponse | null> {
  const stage = getDissatisfactionRescueStage(history)
  if (!stage) return null

  const followUp = resolveDissatisfactionRescueFollowUp(body, stage)
  if (!followUp) return null

  if (followUp === "portal") {
    const reply = normalizeReply("faq", "reply", buildDissatisfactionRescuePortalReply())
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

  const action = followUp === "sales" ? "human_sales" : "human_service"
  const reply = `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply(action)}`
  await appendTurn({
    conversationId,
    agent: "faq",
    userText: body,
    assistantText: reply,
    action,
    preview,
  })
  return { ok: true, agent: "faq", reply, action, route: [...route, "faq"] }
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
    if (isPureHandoffAffirmation(body)) {
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
    if (isPureHandoffDecline(body)) {
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

  if (usesLlmFirstRouting() && !hasStructuredFlowPending(history, options?.lastAgent ?? null)) {
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

    if (
      specialist === "sales" &&
      (isSalesConsultationTrigger(body) || isSalesTopicSwitch(body)) &&
      !isProductAvailabilityQuestion(body) &&
      !hasOngoingSalesIntake(history) &&
      !isConfirmationPending(history)
    ) {
      const reply = normalizeReply(
        "sales",
        "reply",
        buildSalesIntakeReply(history, body)
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

    if (
      !result.reply &&
      (result.action === "reply" ||
        (isHumanHandoffPending(history) && !breaksPendingHandoff(body)))
    ) {
      const fallbackReply =
        specialist === "sales" &&
        (isSalesConsultationTrigger(body) || isSalesTopicSwitch(body))
          ? buildSalesIntakeReply(history, body)
          : buildStuckHandoffReply()
      const reply = normalizeReply(
        specialist === "master" ? "faq" : specialist,
        "reply",
        fallbackReply
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
      return { ...result, agent: specialist === "master" ? "faq" : specialist, reply, action: "reply", route }
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
      return faqPendingFlowResult(
        conversationId,
        body,
        buildCarpetRentalPolicyReply(),
        history,
        lastAgent,
        route,
        { persistUser, preview }
      )
    }

    if (isShippingPolicyQuestion(body)) {
      return faqPendingFlowResult(
        conversationId,
        body,
        buildShippingPolicyReply(),
        history,
        lastAgent,
        route,
        { persistUser, preview }
      )
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
      return faqPendingFlowResult(
        conversationId,
        body,
        branchReplyForTurn(body, history),
        history,
        lastAgent,
        route,
        { persistUser, preview }
      )
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
    const reply = normalizeReply("faq", "reply", branchReplyForTurn(body, history))
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
    shouldUseSalesIntakeFastPath(body, history, options?.lastAgent ?? null) &&
    !(isConfirmationPending(history) && isConfirmationAffirmationWithExtra(body))
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
    orderLookupEnabled() &&
    (result.action === "receipt" ||
      result.action === "invoice_tax" ||
      result.action === "invoice_tax_receipt")
  ) {
    return documentFlowResult(
      conversationId,
      body,
      route,
      preview,
      options?.phone,
      history
    )
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

function shouldHandleOrderShippingFlow(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (blocksOrderLookupForSalesConsultation(body, history, lastAgent)) return false
  if (shouldHandleDigitalDocumentFlow(body, history)) return false
  if (shouldHandleServicePraiseFlow(body, history)) return false
  if (shouldHandlePostPurchaseCaseFlow(body, history, lastAgent)) return false
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

  if (extractOrderReference(body, history)) return true

  if (
    extractPhoneFromText(body) &&
    (isPhoneLookupConfirmPending(history) || isOrderNumberRequestPending(history))
  ) {
    return true
  }

  return isShippingStatusQuestion(body)
}

function shouldHandleOrderLookupFlow(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  return (
    shouldHandleDigitalDocumentFlowGuarded(body, history, lastAgent) ||
    shouldHandleOrderShippingFlow(body, history, lastAgent)
  )
}

function shouldHandleDigitalDocumentFlowGuarded(
  body: string,
  history: HistoryMessage[],
  lastAgent: AgentId | null = null
) {
  if (blocksOrderLookupForSalesConsultation(body, history, lastAgent)) return false
  return shouldHandleDigitalDocumentFlow(body, history)
}

async function salesPhotoUploadResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  history?: HistoryMessage[]
): Promise<AgentResponse> {
  const reply = normalizeReply(
    "sales",
    "reply",
    buildSalesPhotoReceivedReply(history ?? [], body)
  )

  if (wasReplyRecentlySent(history ?? [], reply)) {
    return {
      ok: true,
      agent: "sales" as const,
      reply: "",
      action: "reply" as const,
      route: [...route, "sales"],
      duplicateSuppressed: true,
    }
  }

  const { assistantInserted } = await appendTurn({
    conversationId,
    agent: "sales",
    userText: body,
    assistantText: reply,
    action: "reply",
    preview,
  })

  return {
    ok: true,
    agent: "sales" as const,
    reply: assistantInserted ? reply : "",
    action: "reply" as const,
    route: [...route, "sales"],
  }
}

function documentFlowResult(
  conversationId: string,
  body: string,
  route: AgentId[],
  preview?: boolean,
  phone?: string,
  history?: HistoryMessage[]
): Promise<AgentResponse> {
  return resolveDigitalDocumentFlowReply({ body, phone, history }).then(async (reply) => {
    let outbound = reply.trim()
    if (!outbound) outbound = buildNeverStuckReply()

    if (wasReplyRecentlySent(history ?? [], outbound)) {
      return {
        ok: true,
        agent: "master" as const,
        reply: "",
        action: "reply" as const,
        route,
        duplicateSuppressed: true,
      }
    }

    const { assistantInserted } = await appendTurn({
      conversationId,
      agent: "master",
      userText: body,
      assistantText: outbound,
      action: "reply",
      preview,
    })

    return {
      ok: true,
      agent: "master" as const,
      reply: assistantInserted ? outbound : "",
      action: "reply" as const,
      route,
    }
  })
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
    let outbound = reply.trim()
    if (!outbound) {
      outbound = buildNeverStuckReply()
    } else if (wasReplyRecentlySent(history ?? [], outbound)) {
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
      assistantText: outbound,
      action: "shipping",
      preview,
    })

    return {
      ok: true,
      agent: "master" as const,
      reply: assistantInserted ? outbound : "",
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
  try {
    const reply = await resolveOrderShippingReply({ body, phone, history })
    return reply.trim() || buildOrderLookupApiFailureReply()
  } catch {
    return buildOrderLookupApiFailureReply()
  }
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

  const confident = confidentSkipMasterRoute(body, history)
  if (confident) {
    setRoutingPath(conversationId, "t1_skip_master")
    route.push("master")
    const next = MASTER_ROUTE_MAP[confident.action] ?? "faq"
    if (next === "shipping") {
      if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
        return documentFlowResult(conversationId, body, route, preview, phone || undefined, history)
      }
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
    setRoutingPath(conversationId, "sticky")
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

  setRoutingPath(conversationId, "master_llm")

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

  logRouteDisagreement({
    conversationId,
    phone: sharedOptions.phone,
    body,
    guessedRoute: guessMasterRoute(body),
    masterAction,
  })
  const next = MASTER_ROUTE_MAP[masterAction] ?? "faq"
  if (next === "shipping") {
    if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
      return documentFlowResult(conversationId, body, route, preview, phone || undefined, history)
    }
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
  options?: {
    customerName?: string
    preview?: boolean
    phone?: string
    /** When false, skip live n8n/Priority calls (shadow mode). */
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
  try {
  const runtime = await bindRuntimeConfig()

  const body = summarizeTurn(turn)
  const { history, lastAgent, lastAction, resetAt, conversationSummary } =
    await getConversationContext(conversationId)
  bindPriorityApiPreMessageGuard(() =>
    history.some(
      (message) =>
        message.role === "assistant" &&
        /אני על זה, כמה רגעים/i.test(message.content)
    )
  )
  const route: AgentId[] = []
  const preview = options?.preview
  const phone = options?.phone?.trim() || ""
  beginTurnMetrics(conversationId, runtime.activeProfile, phone)
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

  if (isHumanHandoffPending(history) && isHandoffAffirmationWithExtra(body)) {
    const multi = await resolveMultiQuestionTurn(
      conversationId,
      remainderAfterLeadingAffirmation(body) || body,
      history,
      route,
      { lastAction, sessionSummary: conversationSummary, preview },
      {
        reply: buildHumanHandoffConfirmedReply(
          inferHumanHandoffAction(history, lastAgent)
        ),
        action: inferHumanHandoffAction(history, lastAgent),
      }
    )
    if (multi) return finish(multi)
  }

  const multiQuestion = await resolveMultiQuestionTurn(
    conversationId,
    body,
    history,
    route,
    { lastAction, sessionSummary: conversationSummary, preview }
  )
  if (multiQuestion) return finish(multiQuestion)

  const dissatisfactionFollowUp = await dissatisfactionRescueFollowUpResult(
    conversationId,
    body,
    history,
    route,
    preview
  )
  if (dissatisfactionFollowUp) return finish(dissatisfactionFollowUp)

  if (
    turnHasCustomerImage(turn) &&
    isSalesPhotoRequestPending(history) &&
    isActiveSalesConsultation(history, lastAgent)
  ) {
    return finish(
      await salesPhotoUploadResult(conversationId, body, route, preview, history)
    )
  }

  if (
    isAwaitingSalesIntakeAnswer(history) &&
    shouldUseSalesIntakeFastPath(body, history, lastAgent)
  ) {
    return finish(
      await resolveSpecialist(
        conversationId,
        turn,
        "sales",
        history,
        true,
        route,
        sharedOptions
      )
    )
  }

  if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
    return finish(
      await documentFlowResult(conversationId, body, route, preview, phone, history)
    )
  }

  const postHandoffFaq = await resolvePostHandoffFaqTurn(
    conversationId,
    body,
    history,
    route,
    { lastAction, preview }
  )
  if (postHandoffFaq) return finish(postHandoffFaq)

  if (isInactivityPingPending(history)) {
    const ackWithExtra = isInactivityAckWithExtra(body)
    const pureAck = isPureInactivityAck(body) || isInactivityStillHereReply(body)

    if (ackWithExtra) {
      if (
        isSalesTopicSwitch(body) ||
        isSalesConsultationTrigger(body) ||
        /רוצ(?:ה|ים|ות)\s+לקנות/i.test(body)
      ) {
        return finish(
          await resolveSpecialist(
            conversationId,
            turn,
            "sales",
            history,
            true,
            route,
            sharedOptions
          )
        )
      }
      if (isFaqTopicSwitch(body)) {
        return finish(
          await resolveSpecialist(
            conversationId,
            turn,
            "faq",
            history,
            true,
            route,
            sharedOptions
          )
        )
      }
      if (isServiceTopicSwitch(body) && !isDigitalDocumentRequest(body)) {
        return finish(
          await resolveSpecialist(
            conversationId,
            turn,
            "service",
            history,
            true,
            route,
            sharedOptions
          )
        )
      }
    }

    if (!ackWithExtra && pureAck) {
      const prior = lastNonInactivityAssistantText(history)
      const resumeStructuredFlow =
        isFinalizationQuestion(prior) ||
        isHumanHandoffPending(history) ||
        isConfirmationPending(history) ||
        activePostPurchaseCaseKind(history) ||
        isPhoneLookupConfirmPending(history) ||
        isOrderConfirmationPending(history) ||
        isAlternatePhoneRequestPending(history)

      if (resumeStructuredFlow) {
        if (shouldHandlePostPurchaseCaseFlow(body, history, lastAgent)) {
          return postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
        }
        if (shouldHandleOrderLookupFlow(body, history, lastAgent)) {
          return shippingResult(conversationId, body, route, preview, phone, history)
        }
        // Fall through — complete handoff / confirmation without re-asking.
      } else {
        const name = options?.customerName?.trim()
        const line = name ? `מעולה ${name}, אני כאן.` : "מעולה, אני כאן."
        const reply = normalizeReply("faq", "reply", line)
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
    }
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

  const structuredFlow = hasStructuredFlowPending(history, lastAgent)

  if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
    setRoutingPath(conversationId, "t0")
    return finish(
      await documentFlowResult(conversationId, body, route, preview, phone, history)
    )
  }

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

  if (shouldHandlePostPurchaseCaseFlow(body, history, lastAgent)) {
    return postPurchaseCaseResult(conversationId, body, route, preview, phone, history)
  }

  if (shouldHandleDigitalDocumentFlowGuarded(body, history, lastAgent)) {
    return documentFlowResult(conversationId, body, route, preview, phone, history)
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

  if (shouldHandleOrderShippingFlow(body, history, lastAgent)) {
    return shippingResult(conversationId, body, route, preview, phone, history)
  }

  if (isServiceTopicSwitch(body) && !shouldHandleDigitalDocumentFlowGuarded(body, history, lastAgent)) {
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
    if (shouldHandleDigitalDocumentFlowGuarded(body, history, sharedOptions.lastAgent)) {
      return documentFlowResult(conversationId, body, route, preview, phone || undefined, history)
    }
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
  } finally {
    bindPriorityApiBeforeCall(null)
    bindPriorityApiPreMessageGuard(null)
    resetPriorityApiTurnState()
  }
}
