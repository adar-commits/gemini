import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  findOrderByNumber,
  resolveLookupPhoneFromHistory,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

const SHOPIFY_MESSAGE =
  "שלום, מבקשת לבדוק מתי תסופק הזמנה מס' 75488"

describe("order reference lookup", () => {
  it("extracts Shopify-style order numbers", () => {
    assert.equal(extractOrderReference(SHOPIFY_MESSAGE), "75488")
    assert.equal(extractOrderReference("הזמנה #75488"), "75488")
    assert.equal(extractOrderReference("#76859"), "76859")
    assert.equal(extractOrderReference("SO26019625"), "SO26019625")
    assert.equal(extractOrderReference("SO 84197422"), "SO84197422")
  })

  it("uses channel phone when customer already gave order number", () => {
    const phone = resolveLookupPhoneFromHistory([], "+972523925554", SHOPIFY_MESSAGE)
    assert.equal(phone, "0523925554")
  })

  it("matches bare Shopify numbers against Priority ORDNAME suffix", () => {
    const orders: OrderShipmentStatus[] = [
      {
        orderNumber: "SO26075488",
        branchLabel: "אתר אינטרנט",
        statusCode: "3",
        statusLabel: "בדרך",
        statusDescription: "בדרך",
        branchCode: null,
        totalPrice: 100,
        raw: { ORDNAME: "SO26075488" },
      },
      {
        orderNumber: "SO26019999",
        branchLabel: "אתר אינטרנט",
        statusCode: "1",
        statusLabel: "חדש",
        statusDescription: "חדש",
        branchCode: null,
        totalPrice: 200,
        raw: { ORDNAME: "SO26019999" },
      },
    ]

    assert.equal(findOrderByNumber(orders, "75488")?.orderNumber, "SO26075488")
    assert.equal(findOrderByNumber(orders, "SO26075488")?.orderNumber, "SO26075488")
  })
})
