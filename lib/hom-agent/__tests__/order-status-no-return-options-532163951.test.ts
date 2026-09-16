import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import {
  DISSATISFACTION_RESCUE_MARKER,
  shouldBlockReturnOptionsForShippingStatus,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import {
  runStructuredOrderLookupPreTurn,
  runStructuredReturnOptionsPreTurn,
} from "@/lib/hom-agent/pre-turn"

/** Replay 532163951 — order status must never open dissatisfaction exchange/return menu. */
describe("order status not return options (532163951)", () => {
  const phone = "+972501234567"

  const statusOpeners = [
    "היי אשמח לדעת מתי מגיע המשלוח שלי ?",
    "מה סטטוס ההזמנה שלי",
    "איפה ההזמנה שלי",
    "קניתי שטיח ועדיין לא הגיע",
    "הזמנתי שטיח ועדיין לא הגיע",
    "עדיין לא קיבלתי את ההזמנה",
  ]

  for (const text of statusOpeners) {
    it(`blocks return options for: ${text.slice(0, 40)}`, async () => {
      assert.equal(shouldBlockReturnOptionsForShippingStatus(text, []), true)
      assert.equal(shouldOfferReturnOptionsFirst(text, []), false)

      const returnPre = runStructuredReturnOptionsPreTurn({
        turn: { text, media: [] },
        history: [],
        phone,
      })
      assert.equal(returnPre.kind, "skip")

      const orderPre = await runStructuredOrderLookupPreTurn({
        turn: { text, media: [] },
        history: [],
        phone,
      })
      assert.equal(orderPre.kind, "handled")
      if (orderPre.kind !== "handled") return
      assert.doesNotMatch(orderPre.reply, new RegExp(DISSATISFACTION_RESCUE_MARKER))
      assert.match(orderPre.reply, /(?:האם|מספר|טלפון|הזמנה)/i)
    })
  }

  it("does not classify delivery delay as return pickup wait", () => {
    assert.notEqual(
      classifyPostPurchaseCase("קניתי שטיח ועדיין לא הגיע"),
      "return_pickup_pending"
    )
  })

  it("timing frustration alone is not dissatisfaction return menu", () => {
    assert.equal(shouldOfferReturnOptionsFirst("לא מתאים לי בזמנים", []), false)
    assert.equal(classifyPostPurchaseCase("לא מתאים לי בזמנים"), null)
  })

  it("bare return still opens options menu", () => {
    assert.equal(shouldOfferReturnOptionsFirst("רוצה להחזיר את המוצר", []), true)
    const result = runStructuredReturnOptionsPreTurn({
      turn: { text: "רוצה להחזיר את המוצר", media: [] },
      history: [],
      phone,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, new RegExp(DISSATISFACTION_RESCUE_MARKER))
  })
})
