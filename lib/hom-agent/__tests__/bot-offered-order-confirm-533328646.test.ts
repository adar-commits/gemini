import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
  shouldRefuseKnownOrderLookup,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const ASK =
  "*הום בוט :)*\nהיי אירית! מדובר בהזמנה SO26023515 לאיסוף עצמי מהמחסן באיירפורט סיטי?"

/** 533328646 — bot proposed SO26023515 itself; customer כן must look it up, not re-ask phone. */
describe("bot offered order confirm 533328646", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אשמח לברר לגבי האספקה שלי" },
    { role: "assistant", content: ASK },
  ]

  it("treats the bot's own order question as the known order", () => {
    assert.equal(orderIdGivenInThread(history), "SO26023515")
    assert.equal(isKnownOrderConfirmPending(history), true)
  })

  it("binds כן to SO26023515 lookup instead of a phone confirm", () => {
    assert.equal(shouldBindKnownOrderTurn("כן", history), true)
    assert.equal(shouldRefuseKnownOrderLookup("כן", history), false)
    const hints = buildConversationHints({ body: "כן", history })
    assert.match(hints ?? "", /KNOWN ORDER CONFIRM/)
    assert.match(hints ?? "", /SO26023515/)
  })

  it("ignores phone-lookup order cards and multi-order choices", () => {
    const card: HistoryMessage[] = [
      { role: "user", content: "מתי מגיע?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 3 ימים בראשון לציון, על סך 1,090 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦SO26023515⁩)",
      },
    ]
    assert.equal(orderIdGivenInThread(card), null)
    const choice: HistoryMessage[] = [
      { role: "user", content: "מתי מגיע?" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמדובר בהזמנה SO26022165 או SO26023085?",
      },
    ]
    assert.equal(orderIdGivenInThread(choice), null)
  })
})
