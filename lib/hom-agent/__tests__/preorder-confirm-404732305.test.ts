import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import {
  isHumanHandoffOfferText,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import {
  isKnownOrderConfirmPending,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { shouldDeferStructuredPreTurnToLlm } from "@/lib/hom-agent/opening-turn-llm"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום לירון בלום, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/01f36310-52f0-4d04-a520-e6f86dc21338

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26020942`

const ASK =
  "*הום בוט :)*\nהיי לירון! אני מניח שאתם שואלים לגבי ההזמנה SO26020942 שנשלח לכם קישור המעקב שלה - זו ההזמנה שתרצו לבדוק?"

/** 404732305 — כן on the receipt order is a pre-order lookup, not "I don't understand" → human. */
describe("preorder confirm stays with the LLM 404732305", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: "היי, אשמח לדעת מה סטטוס ההזמנה שלי" },
    { role: "assistant", content: ASK },
  ]

  it("treats כן as confirming the receipt order", () => {
    assert.equal(isKnownOrderConfirmPending(history), true)
    assert.equal(shouldBindKnownOrderTurn("כן", history), true)
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, { text: "כן", media: [] }),
      true
    )
  })

  it("does not turn the confusion fallback into a handoff", () => {
    const confused = buildNeverStuckReply()
    assert.equal(isHumanHandoffOfferText(confused), false)
    const afterConfusion: HistoryMessage[] = [
      ...history,
      { role: "user", content: "כן" },
      { role: "assistant", content: confused },
    ]
    assert.equal(isHumanHandoffPending(afterConfusion), false)
    const preTurn = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history: afterConfusion,
    })
    assert.equal(preTurn.kind, "skip")
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(afterConfusion, { text: "כן", media: [] }),
      true
    )
  })

  it("hints a pre-order status lookup, not a human", () => {
    const hints = buildConversationHints({ body: "כן", history })
    assert.match(hints ?? "", /404732305/)
    assert.match(hints ?? "", /SO26020942/)
    assert.match(hints ?? "", /Pre Order/)
    assert.match(hints ?? "", /Never "לא הצלחתי להבין"/)
  })
})
