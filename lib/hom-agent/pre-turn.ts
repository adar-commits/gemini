import { buildThanksAckReply, isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  buildInactivityDeferAck,
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
  isInactivityUnavailableReply,
  lastNonInactivityAssistantText,
} from "@/lib/agents/inactivity"
import { isPostPurchaseIntentConfirmPending } from "@/lib/agents/intent-confirmation"
import {
  buildHumanHandoffConfirmedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
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
  buildSalesPhotoReceivedReply,
  isConfirmationPending,
  isSalesFinalSummaryPending,
  shouldAckSalesRoomPhotoWithoutVision,
} from "@/lib/agents/sales-intake"
import {
  buildDissatisfactionRescuePortalReply,
  buildDissatisfactionRescueReply,
  getDissatisfactionRescueStage,
  resolveDissatisfactionRescueFollowUp,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import { isServiceHandoffSummaryPending } from "@/lib/agents/service-intake"
import {
  lastAssistantWasOutboundDocumentDelivery,
  shouldHandleDigitalDocumentFlow,
  resolveDigitalDocumentFlowReply,
} from "@/lib/agents/digital-document-flow"
import { buildGreetingReply, isCasualGreeting, isCasualSmallTalk } from "@/lib/agents/greeting"
import {
  extractOrderNumber,
  isChannelPhoneSelfReference,
  isOrderConfirmationPending,
  isOrderLookupPhoneReplyPending,
  requiresOrderIdentification,
  resolveOrderShippingReply,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
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

  if (isSalesFinalSummaryPending(input.history) && isHumanHandoffAffirmation(body)) {
    return {
      kind: "handled",
      reply: `${CUSTOMER_HEADER}\n${buildHumanHandoffConfirmedReply("human_sales")}`,
      action: "human_sales",
    }
  }

  if (isHumanHandoffPending(input.history) && isPureHandoffAffirmation(body)) {
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
    }
  }

  if (
    isThanksAcknowledgment(body) &&
    explicitThanks &&
    !isOrderConfirmationPending(input.history) &&
    !isHumanHandoffPending(input.history)
  ) {
    return {
      kind: "handled",
      reply: buildThanksAckReply(input.customerName),
      action: "reply",
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
    isOrderConfirmationPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    isPostPurchaseIntentConfirmPending(history) ||
    isOrderLookupPhoneReplyPending(history)
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
  return {
    kind: "handled",
    reply: buildSalesPhotoReceivedReply(input.history, body, input.turn),
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
    if (followUp === "sales") {
      return {
        kind: "handled",
        reply: `${CUSTOMER_HEADER}\nמעולה! אשמח להעביר את השיחה לנציג מכירות לייעוץ 😊`,
        action: "human_sales",
      }
    }
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

  if (!orderConfirmPending && !phoneLookupPending && !typedPhone) {
    return { kind: "skip", response: null }
  }

  if (!typedPhone && !orderLookupStructuredBinding(body)) {
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

  const action: HomAgentAction =
    /לא ניתן להציג כרגע סטטוס משלוח/i.test(reply) &&
    /האם להעביר לנציג שירות/i.test(reply)
      ? "human_service"
      : "reply"

  return { kind: "handled", reply, action }
}
