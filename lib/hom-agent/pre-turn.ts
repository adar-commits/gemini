import {
  buildThanksAckReply,
  endsWithOptionalFollowUpOffer,
  isThanksAcknowledgment,
} from "@/lib/agents/conversation-close"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  buildInactivityDeferAck,
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
  isInactivityUnavailableReply,
  isWaitingForHumanRepReply,
  lastNonInactivityAssistantText,
} from "@/lib/agents/inactivity"
import { isTransferPromisedInThread } from "@/lib/agents/human-waiting"
import { isPostPurchaseIntentConfirmPending } from "@/lib/agents/intent-confirmation"
import {
  classifyPostPurchaseCase,
  isOrderModificationRequest,
  isRefundTimelineQuestion,
  isReturnPolicyQuestion,
  isReturnShippingFeeQuestion,
} from "@/lib/agents/inquiry-intent"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import {
  extractSku,
  resolveBranchInventoryReply,
  shouldHandleBranchInventory,
} from "@/lib/agents/inventory-lookup"
import {
  buildCarpetPackagingFaqReply,
  buildRefundTimelinePolicyReply,
  buildReturnShippingFeePolicyReply,
  buildRugCleaningServiceFaqReply,
  isCarpetPackagingOpenQuestion,
  isReturnExchangePolicyFaqQuestion,
  isRugCleaningServiceQuestion,
  resolveReturnExchangePolicyReply,
} from "@/lib/agents/policy-subjects"
import {
  buildHumanHandoffConfirmedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffOfferPending,
  isHumanHandoffPending,
  isPendingHandoffCustomerReply,
} from "@/lib/agents/off-topic"
import {
  isFinalizationQuestion,
  isPureHandoffAffirmation,
  replyAwaitingCustomerInput,
} from "@/lib/agents/compound-reply"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import {
  buildPostPurchaseAlternateSizeAdvisorReply,
  isPostPurchaseAlternateSizeAvailabilityQuestion,
  isPostPurchaseAlternateSizeThread,
} from "@/lib/agents/post-purchase-alt-size"
import {
  buildSalesIntakeTurnResult,
  buildSalesPhotoReceivedTurnResult,
  hasOngoingSalesIntake,
  isAwaitingSalesIntakeAnswer,
  isConfirmationPending,
  shouldAckSalesRoomPhotoWithoutVision,
  shouldUseSalesIntakeFastPath,
  turnHasCustomerImage,
} from "@/lib/agents/sales-intake"
import {
  buildDissatisfactionRescuePortalReply,
  buildDissatisfactionRescueReply,
  getDissatisfactionRescueStage,
  resolveDissatisfactionRescueFollowUp,
  shouldBlockReturnOptionsForShippingStatus,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import {
  buildExchangeIntakeStartReply,
  isExchangeIntakeActive,
  isExchangeIntakeStartedInThread,
  isExplicitExchangeExecutionTurn,
} from "@/lib/agents/exchange-intake"
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
import {
  lastAssistantWasOutboundDocumentDelivery,
  shouldHandleDigitalDocumentFlow,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"
import { buildGreetingReply, isCasualGreeting, isCasualSmallTalk } from "@/lib/agents/greeting"
import {
  buildPostOrderLookupContinuationReply,
  isPostOrderShippingFollowUp,
  extractOrderNumber,
  isChannelPhoneSelfReference,
  isExplicitHumanRequest,
  isNumberedReturnPolicyChoicePending,
  isOrderConfirmationPending,
  isOrderDeliveryStatusQuestion,
  isOrderLookupCompletedInThread,
  isOrderLookupPhoneReplyPending,
  isPurePhoneLookupConfirmYes,
  mentionsCancellationDesire,
  isServiceLookupContext,
  isShippingLookupContext,
  requiresOrderIdentification,
  resolveOrderShippingReply,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { remainderAfterLeadingAffirmation } from "@/lib/agents/compound-reply"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import type { AgentId, HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  buildVoiceMessageUnsupportedReply,
  summarizeTurn,
  turnHasVoiceMessage,
} from "@/lib/agents/user-turn"
import type { HomAgentAction } from "@/lib/hom-agent/output-schema"

export type PreTurnResult =
  | { kind: "skip"; response: null }
  | {
      kind: "handled"
      reply: string
      action: HomAgentAction
      suppressInactivityWatch?: boolean
    }

export function runPreTurnGuards(input: {
  turn: UserTurn
  history: HistoryMessage[]
  customerName?: string
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  const explicitThanks = isExplicitThanks(body)

  if (turnHasVoiceMessage(input.turn)) {
    return {
      kind: "handled",
      reply: buildVoiceMessageUnsupportedReply(),
      action: "reply",
    }
  }

  if (isWhatsappAutoresponder(body)) {
    return { kind: "handled", reply: "", action: "end" }
  }

  if (isConfirmationPending(input.history) && isHumanHandoffAffirmation(body)) {
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_sales")}`,
      action: "human_sales",
    }
  }

  if (isHumanHandoffOfferPending(input.history) && isPureHandoffAffirmation(body)) {
    if (isKbSelfServiceFaqThisTurn(body, input.history)) {
      return { kind: "skip", response: null }
    }
    const action = inferHumanHandoffAction(input.history, null)
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply(action)}`,
      action,
    }
  }

  if (
    isInactivityPingPending(input.history) &&
    isPendingHandoffCustomerReply(body, input.history)
  ) {
    const action = inferHumanHandoffAction(input.history, null)
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply(action)}`,
      action,
    }
  }

  if (
    (isWaitingForHumanRepReply(body) || isInactivityStillHereReply(body)) &&
    isTransferPromisedInThread(input.history)
  ) {
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_service")}`,
      action: "human_service",
    }
  }

  if (isInactivityPingPending(input.history) && isWaitingForHumanRepReply(body)) {
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_service")}`,
      action: "human_service",
    }
  }

  if (isInactivityPingPending(input.history) && isInactivityStillHereReply(body)) {
    if (shouldBindInactivityReplyToPriorQuestion(input.history)) {
      // "כן" after "עדיין כאן?" answers the substantive question before the ping — not the ping.
    } else {
      return {
        kind: "handled",
        reply: buildInactivityStillHereAck(input.customerName),
        action: "reply",
      }
    }
  }

  if (isInactivityPingPending(input.history) && isInactivityUnavailableReply(body)) {
    return {
      kind: "handled",
      reply: buildInactivityDeferAck(input.customerName),
      action: "reply",
    }
  }

  if (isHumanHandoffPending(input.history)) {
    if (
      isThanksAcknowledgment(body) &&
      explicitThanks &&
      !isPureHandoffAffirmation(body)
    ) {
      return {
        kind: "handled",
        reply: buildThanksAckReply(input.customerName, { handoffPending: true }),
        action: "reply",
      }
    }
  }

  if (
    isThanksAcknowledgment(body) &&
    explicitThanks &&
    isPostHumanHandoff(null, input.history)
  ) {
    return {
      kind: "handled",
      reply: buildThanksAckReply(input.customerName, { postHandoff: true }),
      action: "reply",
      suppressInactivityWatch: true,
    }
  }

  if (
    isThanksAcknowledgment(body) &&
    explicitThanks &&
    !isOrderConfirmationPending(input.history) &&
    !isHumanHandoffPending(input.history) &&
    !isAwaitingSalesIntakeAnswer(input.history) &&
    !isServiceHandoffSummaryPending(input.history) &&
    !isOrderLookupPhoneReplyPending(input.history)
  ) {
    return {
      kind: "handled",
      reply: buildThanksAckReply(input.customerName),
      action: "end",
      suppressInactivityWatch: true,
    }
  }

  return { kind: "skip", response: null }
}

/**
 * After an inactivity ping, short affirmations bind to the bot's prior turn — not the ping.
 * The ping is procedural; the customer is usually answering the last real question.
 */
function shouldBindInactivityReplyToPriorQuestion(history: HistoryMessage[]) {
  if (!isInactivityPingPending(history)) return false

  if (
    isHumanHandoffPending(history) ||
    isConfirmationPending(history) ||
    isAwaitingSalesIntakeAnswer(history) ||
    isOrderConfirmationPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    isPostPurchaseIntentConfirmPending(history) ||
    isOrderLookupPhoneReplyPending(history) ||
    isTransferPromisedInThread(history)
  ) {
    return true
  }

  const prior = lastNonInactivityAssistantText(history)
  if (!prior) return false
  return isFinalizationQuestion(prior) || replyAwaitingCustomerInput(prior)
}

function isExplicitThanks(body: string) {
  const text = body.trim()
  if (!text || text.length > 80) return false
  return /תוד(?:ה|ים)/iu.test(text) || /\bthanks?\b/i.test(text)
}

function orderLookupStructuredBinding(body: string) {
  return (
    userProvidedPhone(body) != null ||
    isChannelPhoneSelfReference(body) ||
    extractOrderNumber(body) != null
  )
}

/** Post-purchase alternate size — no SKU/photo vision; offer יועץ מכירות. */
export function runStructuredPostPurchaseAltSizePreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  if (!isPostPurchaseAlternateSizeThread(input.history, body)) {
    return { kind: "skip", response: null }
  }

  if (/\[media:image:/i.test(body)) {
    return {
      kind: "handled",
      reply: buildPostPurchaseAlternateSizeAdvisorReply({ photoAck: true }),
      action: "reply",
    }
  }

  if (isPostPurchaseAlternateSizeAvailabilityQuestion(body, input.history)) {
    return {
      kind: "handled",
      reply: buildPostPurchaseAlternateSizeAdvisorReply(),
      action: "reply",
    }
  }

  if (/^(?:אין לי|זה מה ש)/i.test(body.trim())) {
    return {
      kind: "handled",
      reply: buildPostPurchaseAlternateSizeAdvisorReply(),
      action: "reply",
    }
  }

  if (
    /(?:תראה|בהזמנה|ההזמנה שלי)/i.test(body) &&
    isPostPurchaseAlternateSizeThread(input.history, body)
  ) {
    return {
      kind: "handled",
      reply: buildPostPurchaseAlternateSizeAdvisorReply(),
      action: "reply",
    }
  }

  return { kind: "skip", response: null }
}

/**
 * Mid-quiz sales intake — bind customer answer to the next scripted question or summary.
 * Uses bot pending question state only (not customer-intent regex).
 */
export function runStructuredSalesIntakePreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  lastAgent?: AgentId | null
}): PreTurnResult {
  if (turnHasCustomerImage(input.turn)) {
    return { kind: "skip", response: null }
  }

  const body = summarizeTurn(input.turn)
  if (isConfirmationPending(input.history)) {
    return { kind: "skip", response: null }
  }
  if (isOrderConfirmationPending(input.history)) {
    return { kind: "skip", response: null }
  }
  if (isOrderLookupPhoneReplyPending(input.history)) {
    return { kind: "skip", response: null }
  }
  if (
    hasOngoingSalesIntake(input.history) &&
    !isAwaitingSalesIntakeAnswer(input.history)
  ) {
    return { kind: "skip", response: null }
  }

  if (!shouldUseSalesIntakeFastPath(body, input.history, input.lastAgent ?? null)) {
    return { kind: "skip", response: null }
  }

  const turnResult = buildSalesIntakeTurnResult(input.history, body)
  const replyBody = turnResult.reply.trim()
  if (!replyBody) {
    return { kind: "skip", response: null }
  }

  const reply =
    replyBody.startsWith(CUSTOMER_HEADER) || replyBody.startsWith("*הום בוט :)")
      ? replyBody
      : `${CUSTOMER_HEADER}\n${replyBody}`

  return {
    kind: "handled",
    reply,
    action: turnResult.action,
  }
}

/** Sales room photos — ack only, no vision analysis; continue intake. */
export function runStructuredSalesPhotoPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  lastAgent?: AgentId | null
}): PreTurnResult {
  if (!shouldAckSalesRoomPhotoWithoutVision(input.history, input.turn, input.lastAgent ?? null)) {
    return { kind: "skip", response: null }
  }

  const body = summarizeTurn(input.turn)
  const turnResult = buildSalesPhotoReceivedTurnResult(
    input.history,
    body,
    input.turn
  )
  const replyBody = turnResult.reply.trim()
  if (!replyBody) {
    return { kind: "skip", response: null }
  }

  const reply =
    replyBody.startsWith(CUSTOMER_HEADER) || replyBody.startsWith("*הום בוט :)")
      ? replyBody
      : `${CUSTOMER_HEADER}\n${replyBody}`

  return {
    kind: "handled",
    reply,
    action: turnResult.action,
  }
}

/** Deterministic KB FAQ — fee table, care, return policy; never hand off when reps offline. */
export function runStructuredKbSelfServiceFaqPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  if (!isKbSelfServiceFaqThisTurn(body, input.history)) {
    return { kind: "skip", response: null }
  }

  let replyBody: string | null = null
  if (isReturnShippingFeeQuestion(body)) {
    replyBody = buildReturnShippingFeePolicyReply(input.phone)
  } else if (isRugCleaningServiceQuestion(body)) {
    replyBody = buildRugCleaningServiceFaqReply()
  } else if (isCarpetPackagingOpenQuestion(body)) {
    replyBody = buildCarpetPackagingFaqReply()
  } else if (isRefundTimelineQuestion(body)) {
    replyBody = buildRefundTimelinePolicyReply(input.phone)
  } else if (isReturnExchangePolicyFaqQuestion(body) || isReturnPolicyQuestion(body)) {
    replyBody = resolveReturnExchangePolicyReply(body, input.phone)
  }

  if (!replyBody) return { kind: "skip", response: null }

  const reply =
    replyBody.startsWith(CUSTOMER_HEADER) || replyBody.startsWith("*הום בוט :)")
      ? replyBody
      : `${CUSTOMER_HEADER}\n${replyBody}`

  return { kind: "handled", reply, action: "reply" }
}

/** Customer provided a valid מק״ט — run inventory lookup; do not hand off or re-ask. */
export async function runStructuredInventoryPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
}): Promise<PreTurnResult> {
  const body = summarizeTurn(input.turn)
  if (isPostPurchaseAlternateSizeAvailabilityQuestion(body, input.history)) {
    return { kind: "skip", response: null }
  }
  if (isKbSelfServiceFaqThisTurn(body, input.history)) {
    return { kind: "skip", response: null }
  }
  if (!extractSku(body)) {
    return { kind: "skip", response: null }
  }
  if (!shouldHandleBranchInventory(body, input.history)) {
    return { kind: "skip", response: null }
  }

  const reply = await resolveBranchInventoryReply({
    body,
    history: input.history,
  })

  return { kind: "handled", reply, action: "reply" }
}

/** Explicit exchange execution — never returns portal or combined return policy. */
export function runStructuredExchangeExecutionPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  if (isExchangeIntakeActive(input.history) || isExchangeIntakeStartedInThread(input.history)) {
    return { kind: "skip", response: null }
  }
  if (!isExplicitExchangeExecutionTurn(body, input.history)) {
    return { kind: "skip", response: null }
  }

  return {
    kind: "handled",
    reply: buildExchangeIntakeStartReply(),
    action: "reply",
  }
}

/** Exchange + return options before order lookup on bare return / dissatisfaction opens. */
export function runStructuredReturnOptionsPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  const rescueStage = getDissatisfactionRescueStage(input.history)

  if (rescueStage) {
    const followUp = resolveDissatisfactionRescueFollowUp(body, rescueStage)
    if (followUp === "portal") {
      return {
        kind: "handled",
        reply: buildDissatisfactionRescuePortalReply(input.phone),
        action: "reply",
      }
    }
    if (followUp === "exchange_intake") {
      return {
        kind: "handled",
        reply: buildExchangeIntakeStartReply(),
        action: "reply",
      }
    }
    return { kind: "skip", response: null }
  }

  if (shouldBlockReturnOptionsForShippingStatus(body, input.history)) {
    return { kind: "skip", response: null }
  }

  if (!shouldOfferReturnOptionsFirst(body, input.history)) {
    return { kind: "skip", response: null }
  }

  return {
    kind: "handled",
    reply: buildDissatisfactionRescueReply(input.phone),
    action: "reply",
  }
}

/** Receipt / invoice copy — bind phone and call getDocument, not getOrders. */
/** After automated invoice/receipt delivery, bare hello starts a new help flow — not a wrap-up ack. */
export function runStructuredOpeningAfterDocumentDeliveryPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  if (!isCasualGreeting(body) && !isCasualSmallTalk(body)) {
    return { kind: "skip", response: null }
  }
  if (!lastAssistantWasOutboundDocumentDelivery(input.history)) {
    return { kind: "skip", response: null }
  }

  return {
    kind: "handled",
    reply: buildGreetingReply(),
    action: "reply",
  }
}

export async function runStructuredDocumentPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): Promise<PreTurnResult> {
  const body = summarizeTurn(input.turn)
  if (isKbSelfServiceFaqThisTurn(body, input.history)) {
    return { kind: "skip", response: null }
  }
  if (isHumanHandoffPending(input.history)) {
    return { kind: "skip", response: null }
  }
  if (!shouldHandleDigitalDocumentFlow(body, input.history)) {
    return { kind: "skip", response: null }
  }

  const reply = await resolveDigitalDocumentFlowReply({
    body,
    phone: input.phone,
    history: input.history,
  })

  if (/לא הבנתי/i.test(reply)) {
    return { kind: "skip", response: null }
  }

  return { kind: "handled", reply, action: "reply" }
}

/** Structured mid-flow — bind explicit identifiers before the LLM call. */
export async function runStructuredOrderLookupPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): Promise<PreTurnResult> {
  const body = summarizeTurn(input.turn)
  if (shouldHandleDigitalDocumentFlow(body, input.history)) {
    return { kind: "skip", response: null }
  }

  const orderConfirmPending = isOrderConfirmationPending(input.history)
  const phoneLookupPending = isOrderLookupPhoneReplyPending(input.history)
  // A phone number only binds the turn to the order flow when order context
  // exists (pending lookup step or an order/shipping ask in the message) — a
  // bare phone in an unrelated message (callback request, signature, digits
  // leaked from media URLs) must reach the LLM instead of hijacking the turn.
  const typedPhone =
    orderConfirmPending ||
    phoneLookupPending ||
    requiresOrderIdentification(body, input.history)
      ? userProvidedPhone(body)
      : null

  const openingShippingStatus =
    !orderConfirmPending &&
    !phoneLookupPending &&
    !typedPhone &&
    !isServiceLookupContext(input.history) &&
    isShippingLookupContext(body, input.history) &&
    requiresOrderIdentification(body, input.history)

  if (!orderConfirmPending && !phoneLookupPending && !typedPhone && !openingShippingStatus) {
    return { kind: "skip", response: null }
  }

  const phoneConfirmBinding =
    phoneLookupPending &&
    (isPurePhoneLookupConfirmYes(body) || isChannelPhoneSelfReference(body))
  const orderConfirmBinding =
    orderConfirmPending &&
    isPurePhoneLookupConfirmYes(body) &&
    !/^(?:כן\s+)?ז(?:ה|ו)(?:\s|$)/i.test(body.trim())
  const pendingLookupFlow = orderConfirmPending || phoneLookupPending
  const deliveryLookupBinding =
    pendingLookupFlow &&
    (isOrderDeliveryStatusQuestion(body) || isShippingStatusQuestion(body))

  if (
    !openingShippingStatus &&
    !typedPhone &&
    !orderLookupStructuredBinding(body) &&
    !phoneConfirmBinding &&
    !orderConfirmBinding &&
    !deliveryLookupBinding
  ) {
    return { kind: "skip", response: null }
  }

  const reply = await resolveOrderShippingReply({
    body,
    phone: input.phone,
    history: input.history,
  })

  // The state machine didn't understand the reply ("כן כן", slang, typos).
  // Hand the turn to the LLM instead of sending a robotic "לא הבנתי" — the
  // model parses colloquial Hebrew and knows the pending-question binding rules.
  if (/לא הבנתי/.test(reply)) {
    return { kind: "skip", response: null }
  }

  const action: HomAgentAction = /לא ניתן להציג כרגע סטטוס משלוח/i.test(reply)
    ? "human_service"
    : "reply"

  return {
    kind: "handled",
    reply,
    action,
    suppressInactivityWatch: endsWithOptionalFollowUpOffer(reply),
  }
}

/** Order already located — rep request or return menu must not restart phone lookup. */
export async function runStructuredPostOrderCompletedPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): Promise<PreTurnResult> {
  const body = summarizeTurn(input.turn)
  if (!isOrderLookupCompletedInThread(input.history)) {
    return { kind: "skip", response: null }
  }
  if (
    isOrderConfirmationPending(input.history) ||
    isOrderLookupPhoneReplyPending(input.history)
  ) {
    return { kind: "skip", response: null }
  }

  const repTarget = remainderAfterLeadingAffirmation(body) || body
  if (isExplicitHumanRequest(repTarget) || isExplicitHumanRequest(body)) {
    const action = inferHumanHandoffAction(input.history, null)
    return {
      kind: "handled",
      reply: buildHumanHandoffConfirmedReply(action),
      action,
    }
  }

  if (isPostOrderShippingFollowUp(body, input.history)) {
    const reply = await buildPostOrderLookupContinuationReply({
      body,
      history: input.history,
      whatsappPhone: input.phone,
    })
    if (reply) {
      const action: HomAgentAction = /העברתי את השיחה/i.test(reply)
        ? inferHumanHandoffAction(input.history, null)
        : "reply"
      return { kind: "handled", reply, action }
    }
    return { kind: "skip", response: null }
  }

  if (isNumberedReturnPolicyChoicePending(input.history, body)) {
    const reply = await buildPostOrderLookupContinuationReply({
      body,
      history: input.history,
      whatsappPhone: input.phone,
    })
    if (!reply) return { kind: "skip", response: null }
    return { kind: "handled", reply, action: "reply" }
  }

  return { kind: "skip", response: null }
}

/** Order already located — exchange/modification/cancel must not restart phone lookup. */
export function runStructuredPostOrderExchangePreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): PreTurnResult {
  const body = summarizeTurn(input.turn)
  if (!isOrderLookupCompletedInThread(input.history)) {
    return { kind: "skip", response: null }
  }
  if (isExchangeIntakeActive(input.history) || isExchangeIntakeStartedInThread(input.history)) {
    return { kind: "skip", response: null }
  }
  if (isShippingStatusQuestion(body) && !isOrderModificationRequest(body)) {
    return { kind: "skip", response: null }
  }

  const postCase = classifyPostPurchaseCase(body)
  const wantsModification = isOrderModificationRequest(body)
  const wantsCancel = mentionsCancellationDesire(body)
  const wantsExchange =
    postCase === "exchange_request" || /(?:החלפ|להחליף)/i.test(body)

  if (!wantsModification && !wantsCancel && !wantsExchange) {
    return { kind: "skip", response: null }
  }

  if (wantsExchange || wantsModification) {
    return {
      kind: "handled",
      reply: buildExchangeIntakeStartReply(),
      action: "reply",
    }
  }

  if (shouldOfferReturnOptionsFirst(body, input.history)) {
    return {
      kind: "handled",
      reply: buildDissatisfactionRescueReply(input.phone),
      action: "reply",
    }
  }

  return { kind: "skip", response: null }
}
