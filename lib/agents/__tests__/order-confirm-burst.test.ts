import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiLogContext,
  resetPriorityApiTurnState,
} from "@/lib/agents/priority-webhook"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildOrderConfirmationPrompt,
  buildPhoneLookupConfirmPrompt,
  buildPhoneLookupDeclinedReply,
  isOrderDeliveryStatusQuestion,
  isPureOrderConfirmation,
  pendingOrderNumberFromHistory,
  resolveLookupPhoneFromHistory,
  type OrderShipmentStatus,
} from "@/lib/agents/order-lookup"
import {
  clearOrdersLookupCache,
  rememberConversationOrdersLookup,
} from "@/lib/agents/order-lookup-cache"

const sampleOrder: OrderShipmentStatus = {
  orderNumber: "SO26020772",
  branchLabel: "אתר אינטרנט",
  statusCode: "1",
  statusLabel: "בטיפול",
  statusDescription: "ההזמנה נארזה ומוכנה לאיסוף.",
  branchCode: null,
  totalPrice: 1206,
  raw: { ORDNAME: "SO26020772" },
}

describe("order confirm burst (Gali loop)", () => {
  const confirmation = buildOrderConfirmationPrompt(sampleOrder)
  const baseHistory: HistoryMessage[] = [
    { role: "assistant", content: confirmation, agent: "master" },
  ]

  it("treats confirm + delivery question as pure confirmation", () => {
    const body = "נכון\nמתי ההזמנה צפויה להגיע"
    assert.equal(isPureOrderConfirmation(body), true)
    assert.equal(isOrderDeliveryStatusQuestion(body), true)
  })

  it("does not guess channel phone on confirm when cache and auth are cold", () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "conv-gali-cold",
      whatsappPhone: "+972525926363",
    })

    assert.equal(pendingOrderNumberFromHistory(baseHistory), "SO26020772")
    const phone = resolveLookupPhoneFromHistory(baseHistory, "+972525926363", "נכון")
    assert.equal(phone, null)
  })

  it("resolves conversation cache phone on confirm when cache is warm", () => {
    resetPriorityApiTurnState()
    clearOrdersLookupCache()
    bindPriorityApiLogContext({
      conversationId: "conv-gali",
      whatsappPhone: "+972525926363",
    })
    rememberConversationOrdersLookup("conv-gali", "0525926363", [sampleOrder])

    const phone = resolveLookupPhoneFromHistory(baseHistory, "+972525926363", "נכון")
    assert.ok(phone)
    assert.match(phone!, /5926363/)
  })

  it("does not match declined handoff or fresh phone prompt for merged burst intent", () => {
    const declined = buildPhoneLookupDeclinedReply()
    const phonePrompt = buildPhoneLookupConfirmPrompt("052-5926363")
    assert.match(declined, /נציג שירות אנושי/)
    assert.match(phonePrompt, /קודם אמצא את ההזמנה/)
    assert.equal(isPureOrderConfirmation("נכון\nמתי ההזמנה צפויה להגיע"), true)
  })
})
