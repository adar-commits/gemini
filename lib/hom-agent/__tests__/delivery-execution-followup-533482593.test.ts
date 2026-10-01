import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  identifiedOrderNumberFromThread,
  isOrderLookupCompletedInThread,
  isPostOrderShippingFollowUp,
  isShippingThreadFromHistory,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const STATUS_REPLY =
  "*הום בוט :)*\nבדקתי, המשלוח נמצא אצל חברת השליחויות ומתואם לאספקה. נכון לתאריך 29/09/2026 בשעה 10:27\n\nשמחתי לעזור!"

const DELIVERY_EXECUTION_QUESTION = "מתי יbוצע ההספקה?"

function historyBeforeFollowUp(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "רציתי לברר מתי אני אמורה לקבל היום את השטיחים",
    },
    { role: "user", content: "SO26023753" },
    { role: "assistant", content: STATUS_REPLY },
    { role: "user", content: "תודה" },
    {
      role: "assistant",
      content: "*הום בוט :)* ניצה בן עזרא, שמחתי לעזור היום! 😊",
    },
  ]
}

/** 533482593 — delivery execution follow-up after order lookup must not offer handoff first. */
describe("delivery execution follow-up 533482593", () => {
  const history = historyBeforeFollowUp()

  it("binds SO typed by customer after status lookup", () => {
    assert.equal(identifiedOrderNumberFromThread(history), "SO26023753")
    assert.equal(isOrderLookupCompletedInThread(history), true)
  })

  it("recognizes shipping thread from the opening delivery ask", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
  })

  it("hints post-order shipping follow-up without handoff offer", () => {
    const hints = buildConversationHints({ body: DELIVERY_EXECUTION_QUESTION, history }) ?? ""
    assert.match(hints, /533482593/)
    assert.match(hints, /POST-ORDER SHIPPING THREAD/)
    assert.match(hints, /never append האם להעביר לנציג/)
    assert.doesNotMatch(hints, /THANKS AFTER RESOLVED THREAD/)
  })

  it("treats delivery execution phrasing as post-order shipping follow-up", () => {
    assert.equal(isPostOrderShippingFollowUp(DELIVERY_EXECUTION_QUESTION, history), true)
  })
})
