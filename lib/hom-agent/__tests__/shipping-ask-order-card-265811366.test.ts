import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderConfirmationPending } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const ORDER_CARD =
  "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 6 ימים באתר אינטרנט, על סך 894 ש״ח. זו ההזמנה? (מס׳ הזמנה #78420)"

/** 265811366 — after order card, «מתי תשלחו» must lookup, not premature handoff with stale cancel. */
describe("shipping ask on pending order card 265811366", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (050-7337678)",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: ORDER_CARD },
  ]
  const body = "מתי תשלחו את השטיח?"

  it("order card confirm is still pending", () => {
    assert.equal(isOrderConfirmationPending(history), true)
  })

  it("hints lookup before handoff and no stale cancel in recap", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /SHIPPING ASK ON ORDER CARD \(265811366\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /never revive cancel/)
    assert.doesNotMatch(hints, /ORDER CONFIRM NO ISSUE STATED/)
  })
})
