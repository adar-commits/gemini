import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const CONFIRM_QUESTION =
  "*הום בוט :)*\nהיי בן! רק לוודא: מדובר בהזמנה SO26021144, זו שמופיעה בקבלה ובקישור המעקב שנשלחו אליך?"

const PHONE_PROMPT =
  "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-5500999)\nאם לא, אשמח לקבל אותו."

/** Replay 530777437 — "כן, עבר חודש" confirms the named order; RC is a reference to it. */
describe("known order confirm with complaint 530777437", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי\nמה קורה עם ההזמנה. זאת?" },
    { role: "assistant", content: CONFIRM_QUESTION },
  ]

  it("binds כן + delay complaint to the order the bot named", () => {
    assert.equal(orderIdGivenInThread(history), "SO26021144")
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(shouldBindKnownOrderTurn("כן\nעבר חודש", history), true)
    assert.equal(shouldBindKnownOrderTurn("כן עבר חודש", history), true)
  })

  it("hints the named order, not a phone re-ask, on confirm", () => {
    const hints = buildConversationHints({ body: "כן\nעבר חודש", history })
    assert.match(hints ?? "", /KNOWN ORDER CONFIRM/)
    assert.match(hints ?? "", /SO26021144/)
  })

  it("treats a later RC receipt as a reference to the named order", () => {
    const later: HistoryMessage[] = [
      ...history,
      { role: "user", content: "כן\nעבר חודש" },
      { role: "assistant", content: PHONE_PROMPT },
    ]
    const hints = buildConversationHints({ body: "RC269019129", history: later })
    assert.match(hints ?? "", /RECEIPT REF FOR NAMED ORDER \(530777437\)/)
    assert.match(hints ?? "", /lookup_order_status with SO26021144/)
  })
})
