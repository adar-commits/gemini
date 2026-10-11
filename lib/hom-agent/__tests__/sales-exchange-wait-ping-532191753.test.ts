import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPostHumanHandoff } from "@/lib/agents/post-handoff"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const EXCHANGE_HANDOFF =
  "*הום בוט :)*\nמעולה עדידה, אז נעבור לדגם אחר\nלא הצלחתי לפתוח את בקשת ההחלפה במערכת מכאן, אז רשמתי את כל הפרטים:\n• מס׳ הזמנה: #76850\n• סוג החלפה: דגם אחר לגמרי\n• הסיבה: השטיח נראה עייף וחיוור\nכרגע אין יועצי מכירות זמינים — קיבלנו את הפנייה. הצוות חוזר ביום ראשון מ-09:30, ניצור איתכם קשר."

const BAD_REPLY =
  "*הום בוט :)*\nסליחה על ההמתנה עדידה, אני כאן.\n\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history532191753(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "קיבלתי את השטיח ואני מעוניינת להחליף בדגם אחר — השטיח עייף וחיוור",
    },
    { role: "assistant", content: "*הום בוט :)*\nזו ההזמנה? (#76850)" },
    { role: "user", content: "כן" },
    { role: "assistant", content: "*הום בוט :)*\nאיזה סוג החלפה? 1… 2… 3…" },
    { role: "user", content: "3" },
    { role: "assistant", content: EXCHANGE_HANDOFF },
    { role: "user", content: "יש לי דגם שאני מעוניינת" },
    { role: "user", content: "מה עם הפנייה שלי?" },
  ]
}

/** Replay 532191753 — wait ping after sales exchange handoff must not duplicate human_sales. */
describe("sales exchange wait ping (532191753)", () => {
  it("detects sales exchange handoff summary in thread (after-hours wording)", () => {
    const history = history532191753()
    assert.match(EXCHANGE_HANDOFF, /קיבלנו\s+את\s+הפנייה/)
    assert.match(EXCHANGE_HANDOFF, /סוג\s+החלפה/)
    assert.equal(isPostHumanHandoff(null, history), false)
  })

  it("bad reply duplicates first-time sales transfer", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה ליועץ מכירות/)
  })

  it("emits sales exchange wait ping forbidding duplicate human_sales on ?", () => {
    const hints =
      buildConversationHints({
        history: history532191753(),
        body: "?",
      }) ?? ""
    assert.match(hints, /SALES EXCHANGE WAIT PING \(532191753\)/)
    assert.match(hints, /action: reply/)
    assert.match(hints, /NEVER duplicate.*human_sales/i)
  })

  it("emits wait ping on מה עם הפנייה chase", () => {
    const hints =
      buildConversationHints({
        history: history532191753(),
        body: "מה עם הפנייה שלי?",
      }) ?? ""
    assert.match(hints, /SALES EXCHANGE WAIT PING \(532191753\)/)
  })
})
