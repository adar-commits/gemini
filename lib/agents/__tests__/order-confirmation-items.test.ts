import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  extractOrderLineItems,
  mapPriorityOrderRow,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

describe("order confirmation line items", () => {
  const orderWithItems: OrderShipmentStatus = {
    orderNumber: "SO26018130",
    branchLabel: "מעצב אתר - מועדון עמית חבר",
    statusCode: "6",
    statusLabel: "נמסרה",
    statusDescription: "נמסר.",
    branchCode: null,
    totalPrice: 644.8,
    raw: {
      ORDNAME: "SO26018130",
      CURDATE: "2026-08-04T00:00:00Z",
      TOTPRICE: 644.8,
      items: [
        { PARTDES: "שטיח שאגי מרקש 01 קרם", TOTPRICE: 544.8 },
        { PARTDES: "כרית נוי קטיפתית", TOTPRICE: 100 },
        { PARTDES: "כרית נוי קטיפתית", TOTPRICE: 100 },
      ],
    },
  }

  it("extracts product lines from Priority-style item rows", () => {
    const items = extractOrderLineItems(orderWithItems.raw)
    assert.equal(items.length, 3)
    assert.equal(items[0]?.name, "שטיח שאגי מרקש 01 קרם")
    assert.equal(items[0]?.price, 544.8)
  })

  it("appends product lines below the confirmation question", () => {
    const prompt = buildOrderConfirmationPrompt(orderWithItems)
    assert.match(prompt, /SO26018130/)
    assert.match(prompt, /644\.8/)
    assert.match(prompt, /שטיח שאגי מרקש 01 קרם \(544\.8 ש׳׳ח\)/)
    assert.match(prompt, /כרית נוי קטיפתית \(100 ש׳׳ח\)/)
    const lines = prompt.split("\n")
    const summaryIndex = lines.findIndex((line) => line.includes("נכון?"))
    const firstItemIndex = lines.findIndex((line) => line.includes("שטיח שאגי"))
    assert.ok(summaryIndex >= 0)
    assert.ok(firstItemIndex > summaryIndex)
  })

  it("keeps confirmation compact when no items are present", () => {
    const prompt = buildOrderConfirmationPrompt(
      mapPriorityOrderRow({
        ORDNAME: "SO26075503",
        CURDATE: "2026-08-21T00:00:00Z",
        TOTPRICE: 299,
      })
    )
    assert.match(prompt, /75503|SO26075503/)
    assert.doesNotMatch(prompt, /ש׳׳ח\)/)
  })

  it("accepts ORDERITEMS alias from n8n payloads", () => {
    const items = extractOrderLineItems({
      ORDNAME: "SO1",
      ORDERITEMS: [{ name: "שטיח בד", price: 250 }],
    })
    assert.deepEqual(items, [{ name: "שטיח בד", price: 250 }])
  })
})
