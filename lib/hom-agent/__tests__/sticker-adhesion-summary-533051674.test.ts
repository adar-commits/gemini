import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isServiceHandoffSummaryText } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const BAD_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#77384⁩\n• פנייה לשירות לקוחות\n\nזה מדויק, או שחסר משהו?"

function historyThroughOrderConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי לוטן! 😊 במה אפשר לעזור?",
    },
    {
      role: "user",
      content:
        "קניתי מכם מדבקות לשטיח והן לא נדבקות לי לשטיח [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/532802267/BZHSWOE365L8ZV3C03GQLW7SH58D5FNU.jpg]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קיבלתי את התמונה, תודה. מבין שהמדבקות לא נצמדות לשטיח. כדי שנציג שירות יבדוק ויציע פתרון, קודם נאתר את ההזמנה. יש מספר הזמנה? (למשל #76884) אם לא, אפשר לאתר לפי הטלפון שממנו מתכתבים.",
    },
    { role: "user", content: "לפי הטלפון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 15 ימים באתר אינטרנט, על סך 440 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#77384⁩)",
      awaiting: "order_confirm",
    },
    { role: "user", content: "כן" },
  ]
}

/** Replay 533051674 — sticker adhesion defect summary must include problem + photo note. */
describe("sticker adhesion service summary (533051674)", () => {
  it("detects the incomplete service summary from production", () => {
    assert.equal(isServiceHandoffSummaryText(BAD_SUMMARY), true)
    assert.doesNotMatch(BAD_SUMMARY, /מדבקות|נדבק|לא נצמד/)
    assert.doesNotMatch(BAD_SUMMARY, /נשלחו תמונות|תמונה/)
  })

  it("emits service order id hint requiring problem + photo bullets after order confirm", () => {
    const history = historyThroughOrderConfirm()
    const hints = buildConversationHints({ history, body: "כן" }) ?? ""
    assert.match(hints, /533051674/)
    assert.match(hints, /דיווח על בעיה/)
    assert.match(hints, /נשלחו תמונות/)
    assert.match(hints, /never a generic lone/i)
  })
})
