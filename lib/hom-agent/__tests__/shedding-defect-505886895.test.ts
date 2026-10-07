import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { isServiceOrderIdentificationFlow } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "השטיח שקניתי אצלכם כבר לפני חצי שנה , עדיין משיר צמר וזה מלכלך לי את כל הבית"

function historyThroughOrderCard(): HistoryMessage[] {
  return [
    { role: "user", content: "שלום" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nשלום מיטל! 😊 במה אפשר לעזור?",
    },
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-3646467) אם לא, אשמח לקבל אותו.",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 265 ימים בראשון לציון, על סך 799 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26001471)",
    },
  ]
}

/** Replay 505886895 — shedding defect after order confirm must stay service, not shipping/sales. */
describe("shedding defect order confirm (505886895)", () => {
  it("classifies wool shedding on purchased rug as defect", () => {
    assert.equal(classifyPostPurchaseCase(OPENING), "defect")
  })

  it("detects service order identification on confirm", () => {
    const history = historyThroughOrderCard()
    assert.equal(isServiceOrderIdentificationFlow(history, "כן"), true)
  })

  it("emits service order id hint forbidding shipping and sales pivot", () => {
    const hints = buildConversationHints({
      body: "כן",
      history: historyThroughOrderCard(),
      whatsappPhone: "0523646467",
    })
    assert.match(hints, /SERVICE ORDER ID/)
    assert.match(hints, /505886895/)
    assert.match(hints, /Never shipping status/)
    assert.match(hints, /human_sales/)
  })
})
