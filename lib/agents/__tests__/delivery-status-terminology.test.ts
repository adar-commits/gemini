import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDeliveryStatusMessage,
} from "@/lib/agents/delivery-status-terminology"
import {
  buildOrderStatusReply,
  mapPriorityOrderRow,
  orderStatusDatePhrase,
} from "@/lib/agents/order-lookup"

describe("delivery status terminology", () => {
  it("maps in-transit codes 3/4/5/80 to distinct customer messages", () => {
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "3" }),
      /נאסף על ידי חברת השליחויות/
    )
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "4" }),
      /שוייך לשליח/
    )
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "5" }),
      /הועמס לשליח/
    )
    assert.match(
      buildDeliveryStatusMessage({
        deliveryStatusId: "80",
        coordinateDate: "5.9.2026",
      }),
      /מתואם לאספקה בתאריך 5\.9\.2026/
    )
  })

  it("maps pickup-ready code 22 with branch details", () => {
    const message = buildDeliveryStatusMessage({ deliveryStatusId: "22" })
    assert.match(message, /מוכנה לאיסוף עצמי/)
    assert.match(message, /כנרת 10/)
    assert.match(message, /0533702089/)
  })

  it("maps delivered-by-courier code 6 with delivery date", () => {
    const message = buildDeliveryStatusMessage({
      deliveryStatusId: "6",
      deliveryDate: "30.8.2026",
    })
    assert.match(message, /נמסר באמצעות שליח/)
    assert.match(message, /30\.8\.2026/)
  })

  it("maps processing and unknown codes", () => {
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "1" }),
      /נארזה ומוכנה לאיסוף על ידי חברת השליחויות/
    )
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "21" }),
      /טרם מוכנה לאיסוף עצמי/
    )
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "23" }),
      /נאספה באופן עצמאי/
    )
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "99" }),
      /לא ניתן להציג כרגע סטטוס משלוח/
    )
  })

  it("treats code 2 as unmapped because it is not in the delivery CSV", () => {
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "2" }),
      /לא ניתן להציג כרגע סטטוס משלוח/
    )
  })

  it("does not infer delivery copy from unmapped code + label alone", () => {
    assert.match(
      buildDeliveryStatusMessage({
        deliveryStatusId: "15",
        deliveryStatusDesc: "משלוח נוצר",
      }),
      /לא ניתן להציג כרגע סטטוס משלוח/
    )
    assert.match(
      buildDeliveryStatusMessage({
        deliveryStatusId: "99",
        deliveryStatusDesc: "משלוח נוצר",
      }),
      /לא ניתן להציג כרגע סטטוס משלוח/
    )
  })

  it("builds full shipment status from Priority row", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26019842",
      ZPIT_DELSTATUSCODE: "5",
      ZPIT_DELSTATUSDES: "בדרך ללקוח",
      ZPIT_UDATE: "2026-08-30T14:00:00+03:00",
      CURDATE: "2026-08-20T00:00:00Z",
    })
    assert.match(order.statusDescription, /הועמס לשליח/)
    assert.doesNotMatch(order.statusDescription, /עדכון סטטוס אחרון/)
  })

  it("builds checked status reply with as-of date for mapped packed code 1", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26019842",
      ZPIT_DELSTATUSCODE: "1",
      ZPIT_DELSTATUSDES: "בטיפול - טרם הועבר לשליח",
      ZPIT_UDATE: "2026-08-30T14:00:00+03:00",
      Y_7455_0_ESH: "אתר אינטרנט",
    })
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /בדקתי,/)
    assert.match(reply, /נארזה ומוכנה לאיסוף/)
    assert.match(reply, /נכון לתאריך/)
    assert.match(reply, /אפשר לעזור במשהו נוסף/)
    assert.doesNotMatch(reply, /לגבי הזמנה/)
    assert.doesNotMatch(reply, /סטטוס:/)
  })

  it("forwards unmapped delivery code 15 instead of inventing packing or delivered copy", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26019842",
      ZPIT_DELSTATUSCODE: "15",
      ZPIT_DELSTATUSDES: "הוקפא זמנית",
      ORDSTATUSDES: "הושלם",
      ZPIT_UDATE: "2026-08-30T14:00:00+03:00",
    })
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /בדקתי,/)
    assert.match(reply, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.match(reply, /הפנייה תועבר להמשך טיפול/)
    assert.doesNotMatch(reply, /נמסר/)
    assert.doesNotMatch(reply, /בתהליכי אריזה/)
    assert.doesNotMatch(reply, /אפשר לעזור במשהו נוסף/)
  })

  it("does not treat completed order status as delivered without mapped delivery code 6", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26075921",
      ORDSTATUSDES: "הושלם",
      ZPIT_UDATE: "2026-09-07T10:00:00+03:00",
    })
    assert.equal(orderStatusDatePhrase(order), "")
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.doesNotMatch(reply, /נמסרה ליעדה/)
  })

  it("uses ZPIT_DELDATE for delivered delivery status 6", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26075921",
      ZPIT_DELSTATUSCODE: "6",
      ZPIT_DELSTATUSDES: "נמסר",
      ZPIT_DELDATE: "2026-09-05T00:00:00+03:00",
      ZPIT_UDATE: "2026-09-07T10:00:00+03:00",
    })
    assert.match(orderStatusDatePhrase(order), /נמסר בתאריך 5\.9\.2026/)
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /נמסר באמצעות שליח/)
    assert.doesNotMatch(reply, /נכון לתאריך/)
    assert.match(reply, /אפשר לעזור במשהו נוסף/)
  })

  it("does not treat a delivery date as proof of delivery without code 6", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26075921",
      ORDSTATUSDES: "הושלם",
      ZPIT_DELDATE: "2026-09-05T00:00:00+03:00",
    })
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.doesNotMatch(reply, /נמסרה ליעדה/)
    assert.doesNotMatch(reply, /נמסר בתאריך/)
  })
})
