import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDeliveryStatusMessage,
} from "@/lib/agents/delivery-status-terminology"
import {
  buildOrderStatusReply,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"

describe("delivery status terminology", () => {
  it("maps in-transit codes 3/4/5/80 to the shared message", () => {
    for (const code of ["3", "4", "5", "80"]) {
      const message = buildDeliveryStatusMessage({ deliveryStatusId: code })
      assert.match(message, /נארז ונאסף מהמחסנים/)
      assert.match(message, /צפוי להגיע/)
      assert.doesNotMatch(message, /צפוי\/ה/)
    }
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
      /טרם הועברה לחברת השליחויות/
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

  it("maps packed-awaiting-courier code 2 and shipment-created label", () => {
    assert.match(
      buildDeliveryStatusMessage({ deliveryStatusId: "2" }),
      /נארז במחסני החברה/
    )
    assert.match(
      buildDeliveryStatusMessage({
        deliveryStatusId: "99",
        deliveryStatusDesc: "משלוח נוצר",
      }),
      /ממתין לאיסוף/
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
    assert.match(order.statusDescription, /נארז ונאסף מהמחסנים/)
    assert.doesNotMatch(order.statusDescription, /עדכון סטטוס אחרון/)
  })

  it("builds checked status reply with as-of date for shipment created", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26019842",
      ZPIT_DELSTATUSCODE: "2",
      ZPIT_DELSTATUSDES: "משלוח נוצר",
      ZPIT_UDATE: "2026-08-30T14:00:00+03:00",
      Y_7455_0_ESH: "אתר אינטרנט",
    })
    const reply = buildOrderStatusReply(order)
    assert.match(reply, /בדקתי,/)
    assert.match(reply, /נארז במחסני החברה/)
    assert.match(reply, /נכון לתאריך/)
    assert.doesNotMatch(reply, /לגבי הזמנה/)
    assert.doesNotMatch(reply, /סטטוס:/)
  })
})
