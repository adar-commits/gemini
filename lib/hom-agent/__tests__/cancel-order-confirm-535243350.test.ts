import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** 535243350 — cancel + order confirm כן must not warm-close with אריזה + שמחתי לעזור. */
describe("cancel order confirm 535243350", () => {
  const cancelOpen = "הי מבקשת לבטל את הרכישה שעשיתי"

  it("detects cancel wording with רכישה", () => {
    assert.equal(isOrderCancellationSummaryLabel(cancelOpen), true)
    assert.equal(isOrderCancellationSummaryLabel("מבקשת לבטל את הרכישה"), true)
  })

  it("hints cancel routing on order-card confirm כן", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: cancelOpen },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמצאתי הזמנה… זו ההזמנה? (מס׳ הזמנה #78809)",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: "כן",
      whatsappPhone: "0508801500",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL ORDER CONFIRM YES \(535243350/)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING/)
    assert.doesNotMatch(hints!, /ORDER CONFIRM NO ISSUE STATED/)
  })
})
