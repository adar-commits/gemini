import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInventoryAvailabilityReply,
  isPreorderDatePast,
  type InventoryBranchRow,
} from "@/lib/agents/inventory-lookup"

const now = new Date("2026-09-28T10:21:30Z")

function preorderRow(reqDate: string): InventoryBranchRow {
  return {
    sku: "20601072-140190",
    preorder: {
      po_qty: 10,
      open_order_qty: 2,
      current_qty: 0,
      safe_qty: 0,
      req_date: reqDate,
    },
    inventory: [],
  }
}

describe("stale preorder ETA (492752904)", () => {
  it("does not present a past ETA as a live preorder date", () => {
    const reply = buildInventoryAvailabilityReply(preorderRow("2026-09-15"), null, { now })
    assert.doesNotMatch(reply, /זמין כרגע להזמנה מוקדמת/)
    assert.doesNotMatch(reply, /צפי הגעה: 2026-09-15/)
    assert.doesNotMatch(reply, /שמחתי לעזור/)
    assert.match(reply, /20601072-140190/)
    assert.match(reply, /כבר עבר/)
    assert.match(reply, /להעביר ליועץ מכירות/)
  })

  it("keeps a future ETA as a preorder date", () => {
    const reply = buildInventoryAvailabilityReply(preorderRow("15/10/2026"), null, { now })
    assert.match(reply, /זמין כרגע להזמנה מוקדמת/)
    assert.match(reply, /צפי הגעה: 15\/10\/2026/)
  })

  it("treats today's ETA as not past and handles both date formats", () => {
    assert.equal(isPreorderDatePast("2026-09-28", now), false)
    assert.equal(isPreorderDatePast("27/09/2026", now), true)
    assert.equal(isPreorderDatePast("", now), false)
  })
})
