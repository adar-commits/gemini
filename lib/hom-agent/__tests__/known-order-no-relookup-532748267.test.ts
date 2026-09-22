import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  affirmsKnownOrder,
  isKnownOrderConfirmPending,
  orderIdGivenInThread,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום רינת בוסקילה, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/fda75ff9-f7ed-484b-9a6c-ef00d15eddb4

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26022813`

const CONFIRM_QUESTION =
  "*הום בוט :)*\nהיי! אתם שואלים על ההזמנה SO26022813 שקיבלתם עבורה קבלה?"

/** 532748267 — receipt already named the order; confirm must not start a new lookup. */
describe("known order skips fresh lookup 532748267", () => {
  const receiptHistory: HistoryMessage[] = [
    { role: "assistant", content: RECEIPT },
    { role: "user", content: "היי אשמח לדעת מתי השטיח יגיע?" },
    { role: "assistant", content: CONFIRM_QUESTION },
  ]

  it("reads the order id from the receipt, not from a later phone search", () => {
    assert.equal(orderIdGivenInThread(receiptHistory), "SO26022813")
    assert.equal(isKnownOrderConfirmPending(receiptHistory), true)
  })

  it("treats היי, כן as confirming that order", () => {
    assert.equal(affirmsKnownOrder("היי, כן🙏"), true)
    assert.equal(shouldBindKnownOrderTurn("היי, כן🙏", receiptHistory), true)
    assert.equal(
      shouldBindKnownOrderTurn("היי אשמח לדעת מתי השטיח יגיע?", [
        { role: "assistant", content: RECEIPT },
      ]),
      false
    )
  })

  it("still binds after a confusion reply when they confirm the last order", () => {
    const history: HistoryMessage[] = [
      ...receiptHistory,
      { role: "user", content: "היי, כן🙏" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nסליחה, לא הצלחתי להבין את ההודעה\nאפשר לנסח שוב, או שאעביר לנציג שירות שימשיך מכאן?",
      },
    ]
    assert.equal(
      shouldBindKnownOrderTurn("כן, אני מדברת על ההזמנה האחרונה", history),
      true
    )
  })

  it("does not ask for an order number on the opening delivery question", async () => {
    const history: HistoryMessage[] = [{ role: "assistant", content: RECEIPT }]
    const result = await executeLookupOrderStatus({
      body: "היי אשמח לדעת מתי השטיח יגיע?",
      history,
      phone: "+972500000000",
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /SO26022813/)
    assert.match(result.error, /Do NOT call lookup_order_status/)
  })

  it("hints to confirm the receipt order and not start identification", () => {
    const hints = buildConversationHints({
      body: "היי אשמח לדעת מתי השטיח יגיע?",
      history: [{ role: "assistant", content: RECEIPT }],
    })
    assert.match(hints ?? "", /532748267/)
    assert.match(hints ?? "", /SO26022813/)
    assert.match(hints ?? "", /Do NOT ask for מספר הזמנה/)
  })

  it("confirm turn looks up the receipt order instead of asking for a number", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "היי, כן🙏", media: [] },
      history: receiptHistory,
      phone: "+972500000000",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.doesNotMatch(result.reply, /יש לכם מספר הזמנה/)
    assert.doesNotMatch(result.reply, /נבדוק לפי הטלפון/)
    assert.doesNotMatch(result.reply, /רשומה על המספר/)
  })
})
