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

  it("does not append product lines to the pre-confirm order card", () => {
    const prompt = buildOrderConfirmationPrompt(orderWithItems)
    assert.match(prompt, /SO26018130/)
    assert.match(prompt, /644\.8/)
    assert.match(prompt, /נכון\?/)
    assert.doesNotMatch(prompt, /שטיח שאגי/)
    assert.doesNotMatch(prompt, /כרית נוי/)
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
    assert.equal(items[0]?.name, "שטיח בד")
    assert.equal(items[0]?.price, 250)
  })

  it("parses ORDERITEMS_SUBFORM with sku, quantity, line status, and VPRICE", () => {
    const items = extractOrderLineItems({
      ORDNAME: "SO26021446",
      ORDERITEMS_SUBFORM: [
        {
          PARTNAME: "33201138-120170",
          PDES: "מירוץ מכוניות פורמולה 1 קרם אפור 170*120 FORMULA 1",
          TQUANT: 1,
          VPRICE: 465.5,
          ORDISTATUSDES: "Pre Order",
        },
      ],
    })
    assert.equal(items.length, 1)
    assert.equal(items[0]?.sku, "33201138-120170")
    assert.equal(items[0]?.quantity, 1)
    assert.equal(items[0]?.price, 465.5)
    assert.equal(items[0]?.lineStatus, "Pre Order")
  })

  it("maps lineItems onto OrderShipmentStatus", () => {
    const order = mapPriorityOrderRow({
      ORDNAME: "SO26021446",
      TOTPRICE: 465.5,
      ORDERITEMS_SUBFORM: [
        {
          PARTNAME: "33201138-120170",
          PDES: "מירוץ מכוניות",
          VPRICE: 465.5,
        },
      ],
    })
    assert.equal(order.lineItems?.length, 1)
    assert.equal(order.lineItems?.[0]?.sku, "33201138-120170")
  })
})
