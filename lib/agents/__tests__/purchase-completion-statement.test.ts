import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPurchaseCompletionStatement } from "@/lib/agents/inquiry-intent"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { buildOrderConfirmationPrompt } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

describe("purchase completion statement", () => {
  it("detects statements of a completed purchase", () => {
    assert.equal(
      isPurchaseCompletionStatement("עשיתי את ההזמנה דרך הנציג של שטיח האדום."),
      true
    )
    assert.equal(isPurchaseCompletionStatement("כבר הזמנתי אצל הנציג"), true)
    assert.equal(isPurchaseCompletionStatement("סגרתי את ההזמנה, תודה"), true)
  })

  it("does not match questions, complaints, or status inquiries", () => {
    assert.equal(
      isPurchaseCompletionStatement("הזמנתי משלוח לפני שבוע ועדיין לא הגיע"),
      false
    )
    assert.equal(isPurchaseCompletionStatement("הזמנתי, מתי זה מגיע?"), false)
    assert.equal(isPurchaseCompletionStatement("קניתי שטיח ואני רוצה להחזיר"), false)
    assert.equal(isPurchaseCompletionStatement("מה הסטטוס של ההזמנה שהזמנתי"), false)
  })

  it("tool refuses lookup for a purchase statement and instructs a warm ack", async () => {
    const result = await executeLookupOrderStatus({
      body: "עשיתי את ההזמנה דרך הנציג של שטיח האדום.",
      phone: "+972508713127",
      history: [],
    })
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /תתחדשו/)
  })

  it("tool still resolves mid-flow confirmations when an order confirm is pending", async () => {
    const pendingConfirm = buildOrderConfirmationPrompt({
      orderNumber: "76342",
      statusCode: "",
      statusLabel: "",
      branchLabel: "אתר אינטרנט",
      branchCode: null,
      totalPrice: 441,
      statusDescription: "",
      raw: { ORDNAME: "76342" },
    })
    const history: HistoryMessage[] = [
      { role: "assistant", content: pendingConfirm },
    ]
    const result = await executeLookupOrderStatus({
      body: "כבר הזמנתי",
      phone: "+972508713127",
      history,
    })
    // Guard must not block while a confirmation is pending — lookup flow continues.
    assert.equal(typeof result.ok, "boolean")
    if (result.ok === false) {
      assert.doesNotMatch((result as { error: string }).error, /תתחדשו/)
    }
  })
})
