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
import {
  extractOrderNumber,
  isAlternatePhoneRequestPending,
  isChannelPhoneSelfReference,
  isDeliveryEstimateQuestion,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isOrderDeliveryStatusQuestion,
  isPhoneLookupConfirmPending,
  isPureOrderConfirmation,
  resolveOrderShippingReply,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"
import { summarizeTurn } from "@/lib/agents/user-turn"
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
    isOrderDeliveryStatusQuestion(body) ||
    isDeliveryEstimateQuestion(body) ||
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
  const phoneLookupPending =
    isPhoneLookupConfirmPending(input.history) ||
    isAlternatePhoneRequestPending(input.history)

  if (!orderConfirmPending && !phoneLookupPending) {
    return { kind: "skip", response: null }
  }

  if (orderConfirmPending && !orderLookupStructuredBinding(body)) {
    return { kind: "skip", response: null }
  }

  const reply = await resolveOrderShippingReply({
    body,
    phone: input.phone,
    history: input.history,
  })

  const action: HomAgentAction =
    /לא ניתן להציג כרגע סטטוס משלוח/i.test(reply) &&
    /האם להעביר לנציג שירות/i.test(reply)
      ? "human_service"
      : "reply"

  return { kind: "handled", reply, action }
}
