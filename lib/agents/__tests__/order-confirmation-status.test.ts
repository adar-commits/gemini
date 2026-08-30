import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  buildOrderStatusReply,
  orderSummaryFromConfirmationHistory,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"

describe("order confirmation status reply", () => {
  const fullOrder: OrderShipmentStatus = {
    orderNumber: "SO26019842",
    branchLabel: "אתר אינטרנט",
    statusCode: "3",
    statusLabel: "בדרך ללקוח",
    statusDescription: "המשלוח בדרך אליך.\nעדכון סטטוס אחרון: 30.8.2026, 14:00.",
    branchCode: null,
    totalPrice: 0,
    raw: { ORDNAME: "SO26019842", CURDATE: "2026-08-20T00:00:00Z" },
  }

  it("includes delivery status text from a full order payload", () => {
    const reply = buildOrderStatusReply(fullOrder)
    assert.match(reply, /בדרך ללקוח|בדרך אליך/)
    assert.match(reply, /SO26019842/)
  })

  it("cached confirmation summary has no status — must not be used for status reply", () => {
    const prompt = buildOrderConfirmationPrompt(fullOrder)
    const cached = orderSummaryFromConfirmationHistory(
      [{ role: "assistant", content: prompt, agent: "master" }],
      "SO26019842"
    )
    assert.ok(cached)
    assert.equal(cached!.statusDescription, "")
    const reply = buildOrderStatusReply(cached!)
    assert.doesNotMatch(reply, /בדרך/)
  })
})
