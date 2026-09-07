import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOrderConfirmationPrompt,
  buildSelfPickupTimingUnavailableReply,
  isDeliveryEstimateQuestion,
  isSelfPickupTimingQuestion,
  mapPriorityOrderRow,
  resolveOrderShippingReply,
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

describe("self-pickup timing without exact policy", () => {
  const pickupProcessingOrder = mapPriorityOrderRow({
    ORDNAME: "SO26076537",
    REFERENCE: "76537",
    BRANCHNAME: "3000",
    TOTPRICE: 623,
    CURDATE: "2026-09-06T00:00:00Z",
    ZPIT_DELSTATUSCODE: "21",
    ZPIT_DELSTATUSDES: "בטיפול",
    ZPIT_UDATE: "2026-09-06T12:00:00+03:00",
  })

  it("detects when-customer-can-pickup wording", () => {
    assert.equal(isSelfPickupTimingQuestion("מתי אפשר לאסוף את המוצר?"), true)
    assert.equal(isDeliveryEstimateQuestion("מתי היא תהיה מוכנה?"), true)
  })

  it("does not repeat the same status three times for Meirav-style follow-ups", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-meirav-pickup",
      whatsappPhone: "+972528134350",
    })
    rememberConversationOrdersLookup("conv-meirav-pickup", "0528134350", [
      pickupProcessingOrder,
    ])

    const confirmation = buildOrderConfirmationPrompt(pickupProcessingOrder)
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-8134350)",
      },
      { role: "assistant", content: confirmation },
      { role: "user", content: "נכון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, ההזמנה עדיין בטיפול וטרם מוכנה לאיסוף עצמי.",
      },
    ]

    const followUps = [
      "מתי היא תהיה מוכנה?",
      "הבנתי. מתי היא תהיה. מוכנה?",
    ]

    for (const body of followUps) {
      const reply = await resolveOrderShippingReply({
        body,
        phone: "+972528134350",
        history,
      })
      assert.match(reply, /אין לי כרגע מידע/)
      assert.match(reply, /האם להעביר לנציג שירות/)
      assert.doesNotMatch(reply, /בדקתי,/)
    }
  })

  it("offers handoff on first pickup timing question when status is not ready", async () => {
    clearOrdersLookupCache()
    resetPriorityApiTurnState()
    bindPriorityApiLogContext({
      conversationId: "conv-meirav-first-pickup",
      whatsappPhone: "+972528134350",
    })
    rememberConversationOrdersLookup("conv-meirav-first-pickup", "0528134350", [
      pickupProcessingOrder,
    ])

    const history: HistoryMessage[] = [
      { role: "assistant", content: buildOrderConfirmationPrompt(pickupProcessingOrder) },
      { role: "user", content: "נכון" },
    ]

    const reply = await resolveOrderShippingReply({
      body: "מתי אפשר לאסוף את המוצר?",
      phone: "+972528134350",
      history,
    })

    assert.match(reply, /אין לי כרגע מידע/)
    assert.match(reply, /האם להעביר לנציג שירות/)
    assert.doesNotMatch(reply, /בדקתי,/)
  })

  it("buildSelfPickupTimingUnavailableReply can include current status once", () => {
    const reply = buildSelfPickupTimingUnavailableReply(
      "ההזמנה עדיין בטיפול וטרם מוכנה לאיסוף עצמי."
    )
    assert.match(reply, /לפי הסטטוס/)
    assert.match(reply, /אין לי כרגע מידע/)
  })
})
