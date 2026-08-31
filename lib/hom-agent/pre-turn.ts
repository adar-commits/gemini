import { buildClosingAckReply, isConversationClosing } from "@/lib/agents/conversation-close"
import { isWhatsappAutoresponder } from "@/lib/agents/autoresponder"
import {
  buildInactivityStillHereAck,
  isInactivityPingPending,
  isInactivityStillHereReply,
} from "@/lib/agents/inactivity"
import type { HistoryMessage } from "@/lib/agents/types"
import type { UserTurn } from "@/lib/agents/user-turn"
import { summarizeTurn } from "@/lib/agents/user-turn"

export type PreTurnResult =
  | { kind: "skip"; response: null }
  | {
      kind: "handled"
      reply: string
      action: "reply" | "end"
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

  if (isConversationClosing(body)) {
    return {
      kind: "handled",
      reply: buildClosingAckReply(input.customerName),
      action: "reply",
    }
  }

  return { kind: "skip", response: null }
}
