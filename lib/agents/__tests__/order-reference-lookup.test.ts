import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  findOrderByNumber,
  mapPriorityOrderRow,
  resolveCustomerOrderNumber,
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

  it("uses REFERENCE as order number when BRANCHNAME is 3000 (website)", () => {
    const row = {
      ORDNAME: "SO26075488",
      REFERENCE: "75488",
      BRANCHNAME: "3000",
    }
    assert.equal(resolveCustomerOrderNumber(row), "75488")
    assert.equal(mapPriorityOrderRow(row).orderNumber, "75488")
  })

  it("keeps ORDNAME for non-website branches", () => {
    const row = {
      ORDNAME: "SO26075488",
      REFERENCE: "75488",
      BRANCHNAME: "1001",
    }
    assert.equal(resolveCustomerOrderNumber(row), "SO26075488")
  })

  it("matches bare Shopify numbers against Priority ORDNAME suffix", () => {
    const orders: OrderShipmentStatus[] = [
      mapPriorityOrderRow({
        ORDNAME: "SO26075488",
        REFERENCE: "75488",
        BRANCHNAME: "3000",
      }),
      mapPriorityOrderRow({
        ORDNAME: "SO26019999",
        REFERENCE: "19999",
        BRANCHNAME: "3000",
      }),
    ]

    assert.equal(findOrderByNumber(orders, "75488")?.orderNumber, "75488")
    assert.equal(findOrderByNumber(orders, "SO26075488")?.orderNumber, "75488")
  })
})
