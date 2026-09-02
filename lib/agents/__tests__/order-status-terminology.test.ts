import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildOrderStatusMessage } from "@/lib/agents/order-status-terminology"
import {
  buildReturnsPortalUrl,
  personalizeReturnsPortalUrls,
} from "@/lib/agents/policy-subjects"
import {
  countOrderConfirmationPrompts,
  describeShipmentStatus,
  mapPriorityOrderRow,
  MAX_ORDER_PICK_ATTEMPTS,
  requiresOrderStatusServiceHandoff,
} from "@/lib/agents/order-lookup"
import { isExplicitSalesHandoffIntent, inferHumanHandoffAction } from "@/lib/agents/off-topic"
import type { HistoryMessage } from "@/lib/agents/types"

describe("order status terminology", () => {
  it("maps Sheet2 order statuses to customer copy", () => {
    assert.match(buildOrderStatusMessage("בליקוט"), /בתהליכי אריזה/)
    assert.match(buildOrderStatusMessage("העברה מסניף"), /נשלחה מסניף/)
    assert.match(buildOrderStatusMessage("לוקטה"), /ממתינה לאיסוף/)
    assert.match(buildOrderStatusMessage("מאושר לביצוע"), /בתהליכי אריזה/)
    assert.match(buildOrderStatusMessage("מבוטלת"), /בוטלה/)
    assert.match(buildOrderStatusMessage("הושלם"), /נמסרה/)
  })

  it("falls back to order status when delivery status is empty", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26018793",
      ZPIT_DELSTATUSCODE: "",
      ZPIT_DELSTATUSDES: "",
      ORDSTATUSDES: "לוקטה",
      ZPIT_UDATE: "2026-08-18T00:00:00+03:00",
    })
    assert.match(order.statusDescription, /ממתינה לאיסוף/)
    assert.equal(requiresOrderStatusServiceHandoff(order), false)
  })

  it("requires service handoff when both delivery and order status are unknown", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26018793",
      ZPIT_DELSTATUSCODE: "99",
      ZPIT_DELSTATUSDES: "לא ידוע",
      ORDSTATUSDES: "",
      ZPIT_UDATE: "2026-08-18T00:00:00+03:00",
    })
    assert.match(order.statusDescription, /לא ניתן להציג כרגע סטטוס משלוח/)
    assert.equal(requiresOrderStatusServiceHandoff(order), true)
    assert.match(describeShipmentStatus(order), /לא ניתן להציג/)
  })
})

describe("returns portal phone prefill", () => {
  it("builds portal URL with local phone", () => {
    assert.equal(
      buildReturnsPortalUrl("0547495083"),
      "https://returns.carpetshop.co.il/?phone=0547495083"
    )
  })

  it("personalizes bare portal links in replies", () => {
    const reply = personalizeReturnsPortalUrls(
      "פתחו בקשה: https://returns.carpetshop.co.il/",
      "0547495083"
    )
    assert.match(reply, /phone=0547495083/)
  })
})

describe("multi-order pick limit", () => {
  it("caps order confirmation attempts at three", () => {
    assert.equal(MAX_ORDER_PICK_ATTEMPTS, 3)
    const history: HistoryMessage[] = [
      { role: "assistant", content: "נדמה לי שמצאתי את ההזמנה SO1" },
      { role: "assistant", content: "נדמה לי שמצאתי את ההזמנה SO2" },
      { role: "assistant", content: "נדמה לי שמצאתי את ההזמנה SO3" },
    ]
    assert.equal(countOrderConfirmationPrompts(history), 3)
  })
})

describe("service vs sales handoff default", () => {
  it("defaults ambiguous threads to service", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "קיבלתי שטיח פגום" },
      { role: "assistant", content: "האם להעביר לנציג שירות?" },
    ]
    assert.equal(inferHumanHandoffAction(history, null), "human_service")
  })

  it("routes explicit model-selection to sales", () => {
    assert.equal(isExplicitSalesHandoffIntent("תעזור לי לבחור דגם אחר"), true)
    const history: HistoryMessage[] = [
      { role: "user", content: "תעזור לי לבחור דגם אחר שיתאים" },
    ]
    assert.equal(inferHumanHandoffAction(history, null), "human_sales")
  })

  it("does not treat generic שטיח mention as sales", () => {
    const history: HistoryMessage[] = [{ role: "user", content: "השטיח הגיע קרוע" }]
    assert.equal(isExplicitSalesHandoffIntent(history[0]!.content), false)
    assert.equal(inferHumanHandoffAction(history, null), "human_service")
  })
})
