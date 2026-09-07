import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { buildOrderConfirmationPrompt } from "@/lib/agents/order-lookup"
import type { HistoryMessage } from "@/lib/agents/types"

describe("lookup_order_status misuse guards", () => {
  it("rejects lookup when no order/shipping intent exists", async () => {
    const result = await executeLookupOrderStatus({
      body: "היי אשמח לקבל מענה",
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal((result as { errorCode?: string }).errorCode, "lookup_misroute")
  })

  it("rejects non-definitive clarify replies inside confirm flow", async () => {
    const pendingConfirm = buildOrderConfirmationPrompt({
      orderNumber: "76501",
      statusCode: "",
      statusLabel: "",
      branchLabel: "אתר אינטרנט",
      branchCode: null,
      totalPrice: 199,
      statusDescription: "",
      raw: { ORDNAME: "SO26076501" },
    })
    const history: HistoryMessage[] = [
      { role: "assistant", content: pendingConfirm },
    ]

    const result = await executeLookupOrderStatus({
      body: "אולי",
      history,
      phone: "+972547495083",
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(
      (result as { errorCode?: string }).errorCode,
      "lookup_non_definitive"
    )
  })
})
