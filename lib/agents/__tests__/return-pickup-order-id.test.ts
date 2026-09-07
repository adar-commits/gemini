import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  mapPriorityOrderRow,
  selectReturnPickupOrder,
  sortOrdersNewestFirst,
} from "@/lib/agents/order-lookup"
import {
  buildReturnPickupAwaitingServiceReply,
  extractServiceIntake,
} from "@/lib/agents/service-intake"

const OPENING =
  "אני ממתין כבר שבועיים שיאספו ממני שטיח שרציתי להחזיר"

const PRODUCTION_ORDERS = sortOrdersNewestFirst([
  mapPriorityOrderRow({
    CUSTNAME: "1000166010",
    CDES: "Noa Weinberger",
    CURDATE: "2026-08-17T00:00:00+03:00",
    ORDNAME: "SO26019362",
    ORDSTATUSDES: "הושלם",
    TOTPRICE: 495,
    BRANCHNAME: "3000",
    REFERENCE: "#75239",
    ZPIT_DELIVERYDES: "מסירה ללקוח",
    ZPIT_QUANTRETURN: 0,
    ZPIT_DELSTATUSCODE: "1",
    ZPIT_DELSTATUSDES: "משלוח נוצר",
    ZPIT_UDATE: "2026-08-31T16:45:00+03:00",
  }),
  mapPriorityOrderRow({
    CUSTNAME: "1000166010",
    CDES: "Noa Weinberger",
    CURDATE: "2025-12-04T00:00:00+02:00",
    ORDNAME: "SO25025698",
    ORDSTATUSDES: "הושלם",
    TOTPRICE: 1678.85,
    BRANCHNAME: "3000",
    REFERENCE: "#64127",
    ZPIT_DELIVERYDES: "מסירה ללקוח",
    ZPIT_QUANTRETURN: 0,
    ZPIT_DELSTATUSCODE: "6",
    ZPIT_DELSTATUSDES: "נמסרה",
    ZPIT_UDATE: "2025-12-09T12:37:00+02:00",
  }),
])

describe("return pickup order id", () => {
  it("uses newest website REFERENCE from Priority, not invented digits", () => {
    const matched = selectReturnPickupOrder(PRODUCTION_ORDERS, {
      body: OPENING,
      history: [],
      lookupHint: "1041736",
    })

    assert.equal(matched?.orderNumber, "75239")
  })

  it("shows #75239 in service summary for website orders", () => {
    const intake = extractServiceIntake([], OPENING)
    intake.issueKind = "return_pickup_pending"
    intake.orderNumber = PRODUCTION_ORDERS[0]!.orderNumber
    intake.matchedOrder = PRODUCTION_ORDERS[0]!

    const reply = buildReturnPickupAwaitingServiceReply(intake, OPENING)
    assert.match(reply, /75239/)
    assert.match(reply, /#75239/)
    assert.doesNotMatch(reply, /1041736/)
    assert.doesNotMatch(reply, /SO26019362/)
  })

  it("does not show order line without a Priority match", () => {
    const intake = extractServiceIntake([], OPENING)
    intake.issueKind = "return_pickup_pending"
    intake.orderNumber = "1041736"

    const reply = buildReturnPickupAwaitingServiceReply(intake, OPENING)
    assert.doesNotMatch(reply, /מס׳ הזמנה/)
    assert.doesNotMatch(reply, /1041736/)
  })
})
