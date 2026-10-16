import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildOrderConfirmationPrompt,
  resolveOrderShippingReply,
} from "@/lib/agents/order-lookup"
import type { OrderShipmentStatus } from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
  rememberOrdersLookup,
} from "@/lib/agents/order-lookup-cache"

describe("301717226 alternate phone repeats same stale order card", () => {
  const staleOrder: OrderShipmentStatus = {
    orderNumber: "SO23018586",
    branchLabel: "קרית אתא",
    statusCode: "1",
    statusLabel: "בטיפול",
    statusDescription: "ההזמנה נארזה.",
    branchCode: null,
    totalPrice: 740,
    raw: { ORDNAME: "SO23018586", CURDATE: "2023-01-01T00:00:00Z" },
  }

  it("does not re-offer the same order after customer tries another phone", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-301717226",
      whatsappPhone: "+972548818189",
    })
    rememberConversationOrdersLookup("conv-301717226", "0548818189", [staleOrder])
    rememberOrdersLookup("0523408513", [staleOrder])

    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildOrderConfirmationPrompt(staleOrder),
      },
    ]

    const reply = await resolveOrderShippingReply({
      body: "052-340-8513",
      phone: "+972548818189",
      history,
    })

    assert.match(reply, /לא מצאתי הזמנות פעילות/)
    assert.doesNotMatch(reply, /SO23018586/)
    assert.doesNotMatch(reply, /זו ההזמנה\?/)
  })
})
