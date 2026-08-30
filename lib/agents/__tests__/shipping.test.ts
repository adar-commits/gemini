import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { confidentSkipMasterRoute } from "@/lib/agent-core/confident-route"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import { isShippingPolicyQuestion, isShippingStatusQuestion } from "@/lib/agents/shipping"

describe("isShippingStatusQuestion", () => {
  const missedDelivery =
    'קניתי שטיח שככל הנראה היה אמור להיות מסופק בשבוע שעבר השליח צלצל ואנחנו היינו בחו"ל ולא יכולנו לענות רציתי לדעת איפה השטיח ומתי יסופק בשנית'

  it("detects missed delivery with product location question", () => {
    assert.equal(isShippingStatusQuestion(missedDelivery), true)
    assert.equal(confidentSkipMasterRoute(missedDelivery, [])?.action, "ROUTE_TO_SHIPPING_STATUS")
    assert.equal(guessMasterRoute(missedDelivery), "ROUTE_TO_SHIPPING_STATUS")
  })

  it("still matches classic shipping phrases", () => {
    assert.equal(isShippingStatusQuestion("איפה המשלוח שלי"), true)
    assert.equal(isShippingStatusQuestion("מתי זה אמור להגיע"), true)
  })

  it("does not treat general policy as status lookup", () => {
    assert.equal(isShippingPolicyQuestion("כמה ימים לוקח משלוח"), true)
    assert.equal(isShippingStatusQuestion("כמה ימים לוקח משלוח"), false)
  })

  it("detects delayed delivery when order was placed but shipment not received", () => {
    const delayed =
      "הזמנתי לפני שבוע ועוד לא קיבלתי את המשלוח"
    assert.equal(isShippingStatusQuestion(delayed), true)
    assert.equal(guessMasterRoute(delayed), "ROUTE_TO_SHIPPING_STATUS")
  })

  it("does not treat a new purchase intent as status lookup", () => {
    assert.equal(isShippingStatusQuestion("רוצה לקנות שטיח לסלון"), false)
  })
})
