import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  stripAppendedDeliveryPolicyFromOrderStatus,
  isDeliverySchedulingRequest,
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import { buildUncertainHandoffReply } from "@/lib/agent-core/fallbacks"
import { isShippingLookupContext } from "@/lib/agents/order-lookup"

const DELIVERY_SCHEDULING = "אשמח לתאם משלוח לשטיח"

describe("isDeliverySchedulingRequest", () => {
  it("detects proactive delivery coordination", () => {
    assert.equal(isDeliverySchedulingRequest(DELIVERY_SCHEDULING), true)
    assert.equal(isShippingStatusQuestion(DELIVERY_SCHEDULING), false)
    assert.equal(isServiceTopicSwitch(DELIVERY_SCHEDULING), false)
    assert.match(buildUncertainHandoffReply(DELIVERY_SCHEDULING), /נציג שירות/)
  })

  it("does not treat tracking questions as scheduling", () => {
    assert.equal(isDeliverySchedulingRequest("איפה המשלוח שלי"), false)
    assert.equal(isShippingStatusQuestion("איפה המשלוח שלי"), true)
    assert.equal(isShippingLookupContext("איפה המשלוח שלי", []), true)
  })
})

describe("isShippingStatusQuestion", () => {
  const missedDelivery =
    'קניתי שטיח שככל הנראה היה אמור להיות מסופק בשבוע שעבר השליח צלצל ואנחנו היינו בחו"ל ולא יכולנו לענות רציתי לדעת איפה השטיח ומתי יסופק בשנית'

  it("detects missed delivery with product location question", () => {
    assert.equal(isShippingStatusQuestion(missedDelivery), true)
    assert.equal(isShippingLookupContext(missedDelivery, []), true)
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
    const delayed = "הזמנתי לפני שבוע ועוד לא קיבלתי את המשלוח"
    assert.equal(isShippingStatusQuestion(delayed), true)
    assert.equal(isShippingLookupContext(delayed, []), true)
  })

  it("does not treat a new purchase intent as status lookup", () => {
    assert.equal(isShippingStatusQuestion("רוצה לקנות שטיח לסלון"), false)
  })
})

describe("stripAppendedDeliveryPolicyFromOrderStatus", () => {
  it("removes delivery SLA lines from order status replies", () => {
    const raw = `*הום בוט :)*
בדקתי את ההזמנה – היא עדיין בטיפול (נכון לתאריך 30.8.2026).
זמן האספקה לשטיחים ופופים לפירוק הרכבה הוא עד 4 ימי עסקים מיום אישור התשלום.
אם צריך עוד משהו – אני כאן.`
    const cleaned = stripAppendedDeliveryPolicyFromOrderStatus(raw)
    assert.match(cleaned, /עדיין בטיפול/)
    assert.doesNotMatch(cleaned, /4 ימי עסקים/)
    assert.doesNotMatch(cleaned, /זמן האספקה/)
    assert.match(cleaned, /אם צריך עוד משהו/)
  })

  it("leaves general shipping policy FAQ untouched", () => {
    const policy = "לשטיחים ולפופים ל-self assembly: עד 4 ימי עסקים"
    assert.equal(stripAppendedDeliveryPolicyFromOrderStatus(policy), policy)
  })
})
