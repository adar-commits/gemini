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
    statusDescription: "המשלוח נארז ונאסף מהמחסנים, צפוי להגיע בימים הקרובים. התיאום יתבצע על ידי השליח ביום האספקה.",
    branchCode: null,
    totalPrice: 0,
    raw: {
      ORDNAME: "SO26019842",
      CURDATE: "2026-08-20T00:00:00Z",
      ZPIT_UDATE: "2026-08-30T14:00:00+03:00",
    },
  }

  it("includes delivery status text with checked phrasing", () => {
    const reply = buildOrderStatusReply(fullOrder)
    assert.match(reply, /בדקתי,/)
    assert.match(reply, /נארז ונאסף מהמחסנים/)
    assert.match(reply, /נכון לתאריך/)
    assert.doesNotMatch(reply, /לגבי הזמנה/)
  })

  it("cached confirmation summary has no status — falls back to API failure handoff", () => {
    const prompt = buildOrderConfirmationPrompt(fullOrder)
    const cached = orderSummaryFromConfirmationHistory(
      [{ role: "assistant", content: prompt, agent: "master" }],
      "SO26019842"
    )
    assert.ok(cached)
    assert.equal(cached!.statusDescription, "")
    const reply = buildOrderStatusReply(cached!)
    assert.match(reply, /תקלה זמנית/)
    assert.match(reply, /האם להעביר לנציג שירות/)
    assert.doesNotMatch(reply, /בדרך/)
  })
})
