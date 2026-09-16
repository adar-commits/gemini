import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildThanksAckReply,
  buildWarmConversationCloseLine,
  endsWithOptionalFollowUpOffer,
} from "@/lib/agents/conversation-close"
import { buildReturnCancellationPolicyReply } from "@/lib/agents/policy-subjects"
import { ORDER_STATUS_HELP_OFFER } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const CUSTOMER = "Maya"

function historyAfterResolvedFaq(): HistoryMessage[] {
  return [
    { role: "user", content: "מה שעות הפעילות של הסניפים?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\n" +
        buildReturnCancellationPolicyReply("+972501234567").replace(
          /שמחתי לעזור!.*/,
          "שעות הסניפים…\n\nשמחתי לעזור! 😊"
        ),
    },
  ]
}

/** Replay 532201347 — warm close instead of "anything else?" follow-up. */
describe("warm conversation close (532201347)", () => {
  it("builds personalized warm close line", () => {
    assert.equal(
      buildWarmConversationCloseLine(CUSTOMER),
      "Maya, שמחתי לעזור היום! 😊"
    )
    assert.equal(buildWarmConversationCloseLine(), "שמחתי לעזור היום! 😊")
  })

  it("thanks ack closes with warm line — no follow-up question", () => {
    const reply = buildThanksAckReply(CUSTOMER)
    assert.match(reply, /Maya, שמחתי לעזור היום/)
    assert.doesNotMatch(reply, /במה עוד/)
    assert.doesNotMatch(reply, /משהו נוסף/)
    assert.equal(endsWithOptionalFollowUpOffer(reply), true)
  })

  it("pre-turn ends conversation on thanks after resolved answer", () => {
    const result = runPreTurnGuards({
      turn: { text: "תודה רבה", media: [] },
      history: historyAfterResolvedFaq(),
      customerName: CUSTOMER,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "end")
    assert.match(result.reply, /Maya, שמחתי לעזור היום/)
    assert.doesNotMatch(result.reply, /במה עוד/)
  })

  it("order status constant is warm close not a follow-up question", () => {
    assert.match(ORDER_STATUS_HELP_OFFER, /שמחתי לעזור/)
    assert.doesNotMatch(ORDER_STATUS_HELP_OFFER, /משהו נוסף/)
    const reply = `*הום בוט :)*\nבדקתי, המשלוח בדרך.\n\n${ORDER_STATUS_HELP_OFFER}`
    assert.equal(endsWithOptionalFollowUpOffer(reply), true)
  })

  it("hints LLM to end warmly on thanks — not ask again", () => {
    const hints = buildConversationHints({
      body: "תודה",
      history: historyAfterResolvedFaq(),
      whatsappPhone: "0501234567",
      customerName: CUSTOMER,
    })
    assert.match(hints ?? "", /THANKS AFTER RESOLVED THREAD/i)
    assert.match(hints ?? "", /action end/i)
    assert.match(hints ?? "", /במה עוד/)
  })
})
