import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildOrderStatusMessage } from "@/lib/agents/order-status-terminology"
import {
  describeShipmentStatus,
  mapPriorityOrderRow,
  requiresOrderStatusServiceHandoff,
} from "@/lib/agents/order-lookup"

describe("order status terminology", () => {
  it("maps packaging and processing order statuses", () => {
    assert.match(buildOrderStatusMessage("אריזה"), /שלב אריזה/)
    assert.match(buildOrderStatusMessage("בטיפול"), /בטיפול/)
    assert.match(buildOrderStatusMessage("מאושרת"), /אושרה/)
  })

  it("falls back to order status when delivery status is unknown", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26018793",
      ZPIT_DELSTATUSCODE: "",
      ZPIT_DELSTATUSDES: "",
      ORDSTATUSDES: "אריזה",
      ZPIT_UDATE: "2026-08-18T00:00:00+03:00",
    })
    assert.match(order.statusDescription, /שלב אריזה/)
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
