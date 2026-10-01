import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPreorderAwareStatusReply,
  mapPriorityOrderRow,
} from "@/lib/agents/order-lookup"

/** 533801731 — mixed preorder rug + in-stock pillows; status must list every line item. */
describe("mixed order line items 533801731", () => {
  const mixedOrder = mapPriorityOrderRow({
    ORDNAME: "SO26024356",
    REFERENCE: "#76360",
    TOTPRICE: 4200,
    BRANCHNAME: "3000",
    ORDSTATUSDES: "בביצוע",
    ZPIT_DELSTATUSCODE: "12",
    ZPIT_DELSTATUSDES: "נארזה ומוכנה לאיסוף",
    ZPIT_UDATE: "2026-10-01T13:43:00",
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: "SYDNEY-290200",
        PDES: "סידני 02 קרם\\בז 290*200 SYDNEY",
        TQUANT: 1,
        VPRICE: 2800,
        ORDISTATUSDES: "Pre Order",
      },
      {
        PARTNAME: "PILLOW-PAIR-3",
        PDES: "זוג כריות השלישי",
        TQUANT: 1,
        VPRICE: 400,
        ORDISTATUSDES: "בביצוע",
      },
      {
        PARTNAME: "RUG-LARGE-1",
        PDES: "שטיח גדול 01",
        TQUANT: 1,
        VPRICE: 1000,
        ORDISTATUSDES: "בביצוע",
      },
    ],
  })

  it("lists preorder and non-preorder lines together", () => {
    const items = (mixedOrder.lineItems ?? []).map((item) =>
      /pre\s*order/i.test(item.lineStatus ?? "")
        ? { ...item, preorderExpectedDate: "2026-11-15" }
        : item
    )
    const reply = buildPreorderAwareStatusReply(mixedOrder, items)

    assert.match(reply, /סידני 02/)
    assert.match(reply, /זוג כריות השלישי/)
    assert.match(reply, /שטיח גדול 01/)
    assert.match(reply, /כל הפריטים בהזמנה/)
    assert.doesNotMatch(reply, /אין לי כאן פירוט/)
  })
})
