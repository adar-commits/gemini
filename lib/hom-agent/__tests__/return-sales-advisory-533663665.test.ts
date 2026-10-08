import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "דיברתי עם מקס מסניף ראשון לציון ,ביקשתי להחזיר את השטיח שרכשתי ( קיבלתי אותו השבוע) אמר שהעביר בקשה לאיסוף השטיח מביתי . עדיין ממתינה שיחזרו אליי מהעיצוב בכדי להתאים שטיח לסלון שלי"

const BAD_SERVICE_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: SO26024104\n• אי-שביעות רצון מהמוצר\n• משך ההמתנה: שבוע\n• מטרת הפנייה: בקשה לאיסוף\nזה מדויק, או שחסר משהו?"

/** Replay 533663665 — return + design advisory must not get service pickup summary after order confirm. */
describe("return sales advisory 533663665", () => {
  const historyBeforeConfirm: HistoryMessage[] = [
    { role: "user", content: OPENING },
    { role: "assistant", content: "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 9 ימים בראשון לציון, על סך 1,175 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26024104)",
    },
  ]

  it("hints sales advisory handoff after order confirm, not service summary", () => {
    const hints = buildConversationHints({
      history: historyBeforeConfirm,
      body: "כן",
      whatsappPhone: "+972501234567",
    })
    assert.match(hints ?? "", /533663665/)
    assert.match(hints ?? "", /RETURN \+ SALES ADVISORY/i)
    assert.match(hints ?? "", /human_sales/i)
    assert.doesNotMatch(hints ?? "", /SERVICE ORDER ID \(505886895/)
    assert.doesNotMatch(hints ?? "", /SHIPPING ORDER CONFIRM YES/)
    assert.doesNotMatch(hints ?? "", /ORDER CONFIRM YES:.*lookup_order_status/)
  })

  it("documents the wrong service pickup summary to avoid", () => {
    assert.match(BAD_SERVICE_SUMMARY, /בקשה לאיסוף/)
    assert.match(BAD_SERVICE_SUMMARY, /אי-שביעות רצון/)
  })
})
