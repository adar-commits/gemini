import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractOrderReference,
  isOrderNumberRequestPending,
} from "@/lib/agents/order-lookup"
import {
  isAwaitingSalesIntakeAnswer,
  isSalesIntakeQuestionLatest,
  pendingSalesIntakeQuestionKind,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredSalesIntakePreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** 228989877 — additional order lookup; bare order id must not bind to stale sales quiz → human_sales. */
describe("additional order id with stale sales intake 228989877", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מחפש שטיח לסalon" },
    { role: "assistant", content: "*הום בוט :)* לאיזה חדר השטיח מיועד?" },
    { role: "user", content: "עוד הזמנה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה, נבדוק גם את ההזמנה הנוספת. רק לוודא, ההזמנה הזו רשומה על המספר 050-3727765, ותרצי לדעת מה סטטוס המשלוח שלה? אם יש לך גם מספר הזמנה (למשל #77871), אפשר לשלוח אותו.",
    },
    { role: "user", content: "כן תבדוק" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצטער עינב, לא הצלחתי לשלוף כרגע את ההזמנה לפי המספר 050-3727765. יש לך את מספר ההזמנה? הוא מופיע בהודעת האישור או בחשבונית (למשל #77871). ברגע שתשלחי אותו, אמשיך לבדוק את הסטטוס.",
    },
  ]
  const body = "77684"

  it("extracts order id despite open sales quiz", () => {
    assert.equal(pendingSalesIntakeQuestionKind(history), "space")
    assert.equal(isAwaitingSalesIntakeAnswer(history), true)
    assert.equal(isOrderNumberRequestPending(history), true)
    assert.equal(extractOrderReference(body, history), "77684")
  })

  it("hints lookup_order_status — not human_sales or sales summary", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /228989877/)
    assert.match(hints, /77684/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /NOT human_sales/)
  })

  it("sales pre-turn releases the turn — stale space question is not the bot's latest ask", () => {
    assert.equal(isSalesIntakeQuestionLatest(history), false)
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: body, media: [] },
      history,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("real thread: order lookup + Priority wait bubble between quiz and order # still releases", () => {
    const H = "*הום בוט :)*\n"
    const real: HistoryMessage[] = [
      { role: "user", content: "אשמח לקבל ייעוץ" },
      { role: "assistant", content: `${H}בשמחה!\n\nנתחיל בשאלה אחת: לאיזה חלל הפוף מיועד? למשל סלון, חדר ילדים, חדר שינה או מרפסת.` },
      { role: "user", content: "אני רוצה עזרה\nאיפה ההזמנה שלי" },
      { role: "assistant", content: `${H}מה מספר הטלפון שבוצעה עליו ההזמנה? (למשל 050-1234567)` },
      { role: "user", content: "054-998-6979" },
      { role: "assistant", content: `${H}מצאתי הזמנה שבוצעה לפני 10 ימים באתר אינטרנט. זו ההזמנה? (מס׳ הזמנה ⁦#77871⁩)` },
      { role: "assistant", content: `${H}אני על זה, כמה רגעים בבקשה 🙏` },
      { role: "user", content: "כן" },
      { role: "assistant", content: `${H}בדקתי, המשלוח סומן כנמסר באמצעות שליח.\n\nאם יש משהו נוסף שאוכל לעזור בו, אני כאן` },
      { role: "user", content: "עוד הזמנה\n0503727765" },
      { role: "assistant", awaiting: "order_phone_confirm", content: `${H}רק לוודא, ההזמנה הזו רשומה על המספר 050-3727765?` },
      { role: "user", content: "כן תבדוק" },
      ...history.slice(-1),
    ]
    const result = runStructuredSalesIntakePreTurn({
      turn: { text: body, media: [] },
      history: real,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "skip")
  })

  it("still binds when the quiz question is the latest bot message", () => {
    const quiz: HistoryMessage[] = [
      { role: "user", content: "אשמח לקבל ייעוץ" },
      { role: "assistant", content: "*הום בוט :)* לאיזה חדר השטיח מיועד?" },
    ]
    assert.equal(isSalesIntakeQuestionLatest(quiz), true)
  })
})
