import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyDocumentNumber,
  extractOrderReference,
  findOrderByNumber,
  inferCustomerOrderNumberStyle,
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
    assert.equal(extractOrderReference("#36805"), "36805")
    assert.equal(inferCustomerOrderNumberStyle("#36805"), "hash")
    assert.notEqual(inferCustomerOrderNumberStyle("#3680"), "hash")
    assert.notEqual(inferCustomerOrderNumberStyle("#368055"), "hash")
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

  it("uses REFERENCE for non-website branches when populated", () => {
    const row = {
      ORDNAME: "SO26075488",
      REFERENCE: "75488",
      BRANCHNAME: "1001",
    }
    assert.equal(resolveCustomerOrderNumber(row), "75488")
    assert.equal(mapPriorityOrderRow(row).orderNumber, "75488")
  })

  it("uses hash REFERENCE digits from Priority (#76736)", () => {
    const row = {
      ORDNAME: "SO26022330",
      REFERENCE: "#76736",
      BRANCHNAME: "1001",
    }
    assert.equal(resolveCustomerOrderNumber(row), "76736")
    assert.equal(mapPriorityOrderRow(row).orderNumber, "76736")
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

  it("matches # + 5 digits to REFERENCE, not an ORDNAME that merely ends with those digits", () => {
    const byOrdNameSuffix = mapPriorityOrderRow({
      ORDNAME: "SO26036805",
      REFERENCE: "11111",
      BRANCHNAME: "3000",
    })
    const byReference = mapPriorityOrderRow({
      ORDNAME: "SO26099999",
      REFERENCE: "#36805",
      BRANCHNAME: "1001",
    })
    byReference.orderNumber = "SO26099999"
    const orders: OrderShipmentStatus[] = [byOrdNameSuffix, byReference]
    assert.equal(findOrderByNumber(orders, "36805")?.raw.ORDNAME, "SO26099999")
  })

  it("treats RC as a receipt and IN/OV as invoices, not REFERENCE", () => {
    assert.deepEqual(classifyDocumentNumber("RC269019533"), {
      kind: "receipt",
      id: "RC269019533",
    })
    assert.deepEqual(classifyDocumentNumber("IN264019998"), {
      kind: "invoice",
      id: "IN264019998",
    })
    assert.deepEqual(classifyDocumentNumber("OV26010001"), {
      kind: "invoice",
      id: "OV26010001",
    })
    assert.equal(classifyDocumentNumber("#36805"), null)
    assert.equal(extractOrderReference("#36805"), "36805")
  })
})
