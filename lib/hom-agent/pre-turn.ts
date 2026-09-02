import { buildClosingAckReply, isConversationClosing } from "@/lib/agents/conversation-close"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
} from "@/lib/agents/inactivity"
import {
  buildHumanHandoffConfirmedReply,
  buildHumanHandoffDeclinedReply,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { isOrderConfirmationPending } from "@/lib/agents/order-lookup"
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
  }

  if (
    isConversationClosing(body) &&
    !isHumanHandoffPending(input.history) &&
    !isOrderConfirmationPending(input.history)
  ) {
    return {
      kind: "handled",
      reply: buildClosingAckReply(input.customerName),
      action: "reply",
    }
  }

  return { kind: "skip", response: null }
}
