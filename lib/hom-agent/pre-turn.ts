import { buildThanksAckReply, isThanksAcknowledgment } from "@/lib/agents/conversation-close"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  buildInactivityDeferAck,
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
  isInactivityUnavailableReply,
} from "@/lib/agents/inactivity"
import {
  buildHumanHandoffConfirmedReply,
  buildHumanHandoffDeclinedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import {
  extractOrderNumber,
  isChannelPhoneSelfReference,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isOrderLookupPhoneReplyPending,
  isPureOrderConfirmation,
  requiresOrderIdentification,
  resolveOrderShippingReply,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
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

  if (isInactivityPingPending(input.history) && isInactivityStillHereReply(body)) {
    return {
      kind: "handled",
      reply: buildInactivityStillHereAck(input.customerName),
      action: "reply",
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
    if (isHumanHandoffAffirmation(body)) {
      const action = inferHumanHandoffAction(input.history, null)
      return {
        kind: "handled",
        reply: buildHumanHandoffConfirmedReply(action),
        action,
      }
    }
    if (isHumanHandoffDecline(body)) {
      return {
        kind: "handled",
        reply: buildHumanHandoffDeclinedReply(),
        action: "reply",
      }
    }
    if (isThanksAcknowledgment(body)) {
      return {
        kind: "handled",
        reply: buildThanksAckReply(input.customerName, { handoffPending: true }),
        action: "reply",
      }
    }
  }

  if (isThanksAcknowledgment(body) && isPostHumanHandoff(null, input.history)) {
    return {
      kind: "handled",
      reply: buildThanksAckReply(input.customerName, { postHandoff: true }),
      action: "reply",
    }
  }

  if (
    isThanksAcknowledgment(body) &&
    !isOrderConfirmationPending(input.history)
  ) {
    return {
      kind: "handled",
      reply: buildThanksAckReply(input.customerName),
      action: "reply",
    }
  }

  return { kind: "skip", response: null }
}

function orderLookupStructuredBinding(body: string) {
  return (
    isPureOrderConfirmation(body) ||
    isOrderConfirmationNo(body) ||
    userProvidedPhone(body) != null ||
    isChannelPhoneSelfReference(body) ||
    extractOrderNumber(body) != null
  )
}

/** Structured mid-flow — bind כן/לא/phone before LLM can paraphrase or miss intent. */
export async function runStructuredOrderLookupPreTurn(input: {
  turn: UserTurn
  history: HistoryMessage[]
  phone?: string
}): Promise<PreTurnResult> {
  const body = summarizeTurn(input.turn)
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

  if (
    orderConfirmPending &&
    !typedPhone &&
    !phoneLookupPending &&
    !orderLookupStructuredBinding(body)
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

  const action: HomAgentAction =
    /לא ניתן להציג כרגע סטטוס משלוח/i.test(reply) &&
    /האם להעביר לנציג שירות/i.test(reply)
      ? "human_service"
      : "reply"

  return { kind: "handled", reply, action }
}
