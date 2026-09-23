import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import {
  isKnownOrderConfirmPending,
  isKnownOrderIdentificationMisroute,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
  shouldLookupReceiptOrderAfterWrongPick,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום תורג'מן טליה, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/c3aed9c0-ed4f-42a9-8a69-e3fa97185b0d

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26021723`

const ASK =
  "*הום בוט :)*\nהיי! מדובר בהזמנה SO26021723 שכבר שלחנו לך את הקבלה עליה?"

const REASK =
  "*הום בוט :)*\nמעולה, תודה על האישור\nכדי שאוכל למצוא את הסטטוס המדויק של ההזמנה — אפשר לשלוח את מספר ההזמנה או הטלפון שעליו רשומה ההזמנה?"

const WRONG_CARD =
  "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 184 ימים בראשון לציון על סך 1,250 ש׳׳ח נכון? (מס׳ הזמנה ⁦SO26007484⁩)"

/** 508272038 — receipt order confirmed, then wrong phone pick must not win. */
describe("known order wrong pick 508272038", () => {
  const afterConfirmAsk: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: "היי מה קורה מתי מגיע הפופים" },
    { role: "assistant", content: ASK },
  ]

  it("reads SO26021723 from the receipt template", () => {
    assert.equal(orderIdGivenInThread(afterConfirmAsk), "SO26021723")
    assert.equal(isKnownOrderConfirmPending(afterConfirmAsk), true)
  })

  it("binds כן to the receipt order, not a fresh id ask", () => {
    assert.equal(shouldBindKnownOrderTurn("כן", afterConfirmAsk), true)
    assert.equal(isKnownOrderIdentificationMisroute(REASK), true)
  })

  it("after wrong order card, לא recovers the receipt order not never-stuck", () => {
    const history: HistoryMessage[] = [
      ...afterConfirmAsk,
      { role: "user", content: "כן" },
      { role: "assistant", content: REASK },
      { role: "user", content: "0525368636" },
      { role: "assistant", content: WRONG_CARD },
    ]
    assert.equal(
      shouldLookupReceiptOrderAfterWrongPick("לא", history),
      true
    )
    assert.equal(
      shouldLookupReceiptOrderAfterWrongPick(
        "לא\n[תמונה][media:image:https://example.com/receipt.jpg]",
        history
      ),
      true
    )
    const confused = buildNeverStuckReply()
    const afterConfusion: HistoryMessage[] = [
      ...history,
      { role: "user", content: "לא" },
      { role: "assistant", content: confused },
    ]
    assert.equal(
      shouldLookupReceiptOrderAfterWrongPick("לא", afterConfusion),
      true
    )
  })

  it("hints wrong-card recovery with the receipt order id", () => {
    const history: HistoryMessage[] = [
      ...afterConfirmAsk,
      { role: "user", content: "כן" },
      { role: "assistant", content: WRONG_CARD },
    ]
    const hints = buildConversationHints({ body: "לא", history })
    assert.match(hints ?? "", /508272038/)
    assert.match(hints ?? "", /SO26021723/)
    assert.match(hints ?? "", /SO26007484/)
  })
})
