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

  it("passes the flow's own phone-confirm step through as a real reply (528509859 regression)", async () => {
    // First shipping-status turn: the lookup flow asks phone-confirm BEFORE any
    // API call — that is the flow WORKING, not tool misuse. Rejecting it pushed
    // the LLM into recovery where it hallucinated "אני רואה כמה הזמנות" and
    // promised a lookup that never happened (nothing reached n8n).
    const result = await executeLookupOrderStatus({
      body: "אני מבקש לדעת מתי יגיע השטיח שהזמנו",
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /רשומה על המספר|מספר ההזמנה|טלפון/)
  })

  it("handles ambiguous mid-confirm replies deterministically instead of rejecting to LLM", async () => {
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

    // Ambiguous answers stay inside the lookup flow (re-clarify) — only a
    // genuine "לא הבנתי" reply is handed back to the LLM as non-definitive.
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /רשומה על המספר|מספר ההזמנה/)
  })
})
