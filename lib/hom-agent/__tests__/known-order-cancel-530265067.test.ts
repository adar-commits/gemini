import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  shouldBindKnownOrderTurn,
  shouldLookupKnownOrderForCancel,
  shouldRefuseKnownOrderLookup,
} from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import type { HistoryMessage } from "@/lib/agents/types"

const RECEIPT = `שלום גן וינגייט, 👋
תודה על רכישתך בשטיח האדום, להלן קישור לקבלה הדיגיטלית שלך:
https://documents.carpetshop.co.il/documents/example

למעקב אחר התקדמות ההזמנה, יש ללחוץ כאן:
https://tracking.carpetshop.co.il/track?orderID=SO26020459`

const OPENING = `היי
הזמנתי שטיח ולא קיבלתי אותו
עבר כבר חודש!!
אני רוצה לבטל את ההזמנה ולקבל החזר כספי`

/** 530265067 — receipt order + explicit cancel must not become "לא הצלחתי להבין". */
describe("known order cancel 530265067", () => {
  const history: HistoryMessage[] = [{ role: "assistant", content: RECEIPT }]

  it("looks up the receipt order instead of blocking until כן", () => {
    assert.equal(shouldLookupKnownOrderForCancel(OPENING, history), true)
    assert.equal(shouldRefuseKnownOrderLookup(OPENING, history), false)
    assert.equal(shouldBindKnownOrderTurn(OPENING, history), false)
  })

  it("still asks once on a bare delivery question", () => {
    const body = "היי אשמח לדעת מתי השטיח יגיע?"
    assert.equal(shouldLookupKnownOrderForCancel(body, history), false)
    assert.equal(shouldRefuseKnownOrderLookup(body, history), true)
  })

  it("hints to look up that order and never send the confusion line", () => {
    const hints = buildConversationHints({ body: OPENING, history })
    assert.match(hints ?? "", /530265067/)
    assert.match(hints ?? "", /SO26020459/)
    assert.match(hints ?? "", /לא הצלחתי להבין/)
    assert.doesNotMatch(hints ?? "", /Ask once whether they mean/)
  })

  it("lookup tool does not refuse the cancel turn", async () => {
    const result = await executeLookupOrderStatus({
      body: OPENING,
      history,
      phone: "+972504343030",
    })
    if (!result.ok) {
      assert.doesNotMatch(result.error, /Do NOT call lookup_order_status/)
      assert.doesNotMatch(result.error, /No live order/)
      return
    }
    assert.doesNotMatch(result.reply, /לא הצלחתי להבין/)
    assert.doesNotMatch(result.reply, /יש לכם מספר הזמנה/)
    assert.doesNotMatch(result.reply, /רשומה על המספר/)
  })
})
