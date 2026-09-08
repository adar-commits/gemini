import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import {
  buildOrderConfirmationPrompt,
  buildOrderStatusReply,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
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

  it("does not misroute when customer rejects the identified order after status", async () => {
    const first: OrderShipmentStatus = {
      orderNumber: "SO26019813",
      statusCode: "6",
      statusLabel: "נמסר",
      branchLabel: "קרית אתא",
      branchCode: null,
      totalPrice: 500,
      statusDescription: "המשלוח סומן כנמסר באמצעות שליח בתאריך 26.8.2026.",
      raw: { ORDNAME: "SO26019813", CURDATE: "2026-08-20T00:00:00Z" },
    }
    const second: OrderShipmentStatus = {
      ...first,
      orderNumber: "SO26019999",
      raw: { ORDNAME: "SO26019999", CURDATE: "2026-09-01T00:00:00Z" },
    }
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-reject-after-status",
      whatsappPhone: "+972523960124",
    })
    rememberConversationOrdersLookup("conv-reject-after-status", "0523960124", [
      first,
      second,
    ])

    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(first) },
      { role: "user", content: "כן" },
      { role: "assistant", content: buildOrderStatusReply(first) },
    ]

    const result = await executeLookupOrderStatus({
      body: "אז זה לא זה",
      history,
      phone: "+972523960124",
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /SO26019999/)
    assert.doesNotMatch(result.reply, /היי אשמח לקבל מענה/)
  })
})
