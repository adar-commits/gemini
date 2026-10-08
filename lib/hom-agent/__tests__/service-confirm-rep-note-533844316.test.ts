import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const H = "*הום בוט :)*\n"

const history: HistoryMessage[] = [
  { role: "assistant", content: `${H}היי היי! 😊 במה אפשר לעזור?` },
  { role: "user", content: "הגיע אלי שטיח ואני רוצה להחליף מידה" },
  {
    role: "assistant",
    content: `${H}קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-3221627)\nאם לא, אשמח לקבל אותו.`,
  },
  { role: "user", content: "כן" },
  {
    role: "assistant",
    content: `${H}מצאתי הזמנה שבוצעה לפני 4 ימים באתר אינטרנט, על סך 1,494 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦#78318⁩)`,
  },
  { role: "assistant", content: `${H}אני על זה, כמה רגעים בבקשה 🙏` },
  { role: "user", content: "כן" },
  {
    role: "assistant",
    content: `${H}כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#78318⁩\n• בקשת החלפה\nזה מדויק, או שחסר משהו?`,
  },
]

/** Replay 533844316 — confirm without a stated goal must not hand the model a generic rep-note line. */
describe("service summary confirm rep note (533844316)", () => {
  it("binds human_service without the generic המשך טיפול שירות note", () => {
    const hints = buildConversationHints({ body: "מדויק", history }) ?? ""
    assert.match(hints, /Service summary confirm \(533773292\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /המשך טיפול שירות/)
    assert.match(hints, /no rep note line/)
  })
})
