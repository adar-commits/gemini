import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPreorderEtaSharedInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 511324782 — unhappy with preorder date → service, never pitch cancel. */
describe("preorder ETA unsatisfied 511324782", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היישלום\nהזמנתי שטיח\nמתי הוא אמור להגיע?" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (050-5713706)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 31 ימים באתר אינטרנט על סך 1,125 ש׳׳ח נכון? (מס׳ הזמנה ⁦#75253⁩)",
    },
    { role: "user", content: "נכון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי את ההזמנה — הפריט רשום כהזמנה מוקדמת, ולכן עדיין אין סטטוס משלוח.\n\nאייקוניק אפור בהיר 290*200 ICONIC — הזמנה מוקדמת, צפי הגעה: 15/11/2026\n\nשמחתי לעזור! 😊",
    },
  ]

  const body = "לא\nרוצה שירות לקוחות\nאו לבטל"

  it("detects that a preorder ETA was already shared", () => {
    assert.equal(isPreorderEtaSharedInThread(history), true)
    assert.equal(isPreorderEtaSharedInThread([]), false)
  })

  it("hints service handoff and forbids a cancel pitch", () => {
    const hints = buildConversationHints({
      body,
      history,
    })
    assert.match(hints ?? "", /PREORDER ETA UNSATISFIED/)
    assert.match(hints ?? "", /human_service/)
    assert.match(hints ?? "", /Never "אין בעיה, אפשר לבטל"/)
  })
})
