import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  buildSalesIntakeTurnResult,
  isSalesPhotoDeclineAnswer,
  isSalesPhotoRequestPending,
  pendingSalesIntakeQuestionKind,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** Replay 534274234 — לא on optional room photo must continue intake, not human_sales. */
describe("sales photo decline (534274234)", () => {
  const historyBeforePhotoDecline: HistoryMessage[] = [
    { role: "user", content: "היי אשמח להתייעץ" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי נופר! 😊 בשמחה. על מה תרצי להתייעץ? שטיח, פוף או משהו אחר?",
    },
    { role: "user", content: "שטיח" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מעולה 🙂 לאיזה חלל השטיח? סלון, חדר שינה, חדר ילדים או משהו אחר?",
    },
    { role: "user", content: "סלון" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* סלון, מעולה. מה בערך גודל הספה, או המידות הכלליות של הסלון (למשל 4×5 מ׳)?",
    },
    { role: "user", content: "הספה 2.50 מטר עם שזלונג 1.90" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* תודה, רשמתי — ספה של 2.50 מ׳ עם שזלונג של 1.90 מ׳. השטיח צריך להתאים גם לבעלי חיים?",
    },
    { role: "user", content: "לא" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* אין בעיה.\n\nאפשר לשלוח תמונה אחת ברורה של הסלון? זה יעזור ליועץ העיצוב. אם לא נוח לך, אפשר גם לדלג.",
    },
  ]

  it("detects optional room photo pending before decline", () => {
    assert.equal(isSalesPhotoRequestPending(historyBeforePhotoDecline), true)
    assert.equal(pendingSalesIntakeQuestionKind(historyBeforePhotoDecline), "style_photo")
  })

  it("treats לא as photo skip, not handoff trigger", () => {
    assert.equal(isSalesPhotoDeclineAnswer("לא"), true)
    const turn = buildSalesIntakeTurnResult(historyBeforePhotoDecline, "לא")
    assert.equal(turn.action, "reply")
    assert.match(turn.reply, /דרישות מיוחדות|קל לניקוי/)
    assert.doesNotMatch(turn.reply, /מעביר ליועץ|human_sales/i)
  })

  it("emits SALES PHOTO DECLINE hint on לא after optional photo offer", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const hints = buildConversationHints({
      body: "לא",
      history: historyBeforePhotoDecline,
      phone: "+972547495083",
    })
    assert.match(hints ?? "", /SALES PHOTO DECLINE \(534274234\)/i)
    assert.match(hints ?? "", /never.*human_sales/i)
  })
})
