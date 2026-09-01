import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clearOrdersLookupCache,
  recallOrdersLookup,
  rememberOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"

const sampleOrder: OrderShipmentStatus = {
  orderNumber: "SO26020975",
  branchLabel: "אתר אינטרנט",
  statusCode: "1",
  statusLabel: "בטיפול - טרם הועבר לשליח",
  statusDescription: "ההזמנה נארזה ומוכנה לאיסוף על ידי חברת השליחויות.",
  branchCode: null,
  totalPrice: 174.9,
  raw: { ORDNAME: "SO26020975" },
}

describe("order lookup cache", () => {
  it("recalls orders by normalized phone without a second fetch", () => {
    clearOrdersLookupCache()
    rememberOrdersLookup("0547380553", [sampleOrder])
    const cached = recallOrdersLookup("054-738-0553")
    assert.ok(cached)
    assert.equal(cached![0]?.orderNumber, "SO26020975")
    assert.equal(cached![0]?.statusCode, "1")
  })

  it("expires cached orders after TTL", () => {
    clearOrdersLookupCache()
    rememberOrdersLookup("0547380553", [sampleOrder])
    const originalNow = Date.now
    Date.now = () => originalNow() + 16 * 60 * 1000
    try {
      assert.equal(recallOrdersLookup("0547380553"), null)
    } finally {
      Date.now = originalNow
    }
  })
})
