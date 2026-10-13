import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "זה כבר ממש לא לעניין. שירות לקוחות מאכזב ברמות. ההזמנה שלי כבר מתעכבת בצורה משמעותית, אין שום עדכון מצידכם, המענה פה פעם בכמה שעות או ימים ואין אפשרות לדבר איתכם טלפונית. זה לא הגיוני שצריך לרדוף אחריכם ואחרי ההזמנה שהתחייבתם לספק תוך 4 ימי עסקים. אני מצפה לקבל עדכון מיידי ומועד אספקה מדויק"

const BAD_HANDOFF =
  "*הום בוט :)* רחלי, מבין שחיכית הרבה ושקשה לקבל עדכון. מצטער על העיכוב. לפי העדכון האחרון, הזמנה #77260 עדיין בתהליכי אריזה במחסני החברה, ועוד לא נמסרה לחברת השליחויות. בגלל זה אין לי כאן מועד אספקה מדויק. מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

/** Replay 505087102 — angry shipping delay handoff must not open with «מעולה». */
describe("angry shipping handoff tone 505087102", () => {
  const history: HistoryMessage[] = [
    {
      role: "user",
      content: "מה זה עוזר?",
    },
  ]

  it("hints neutral handoff tone on angry delay escalation", () => {
    const hints = buildConversationHints({
      history,
      body: OPENING,
      whatsappPhone: "+972501234567",
    })
    assert.match(hints, /ANGRY SHIPPING DELAY HANDOFF \(505087102\)/)
    assert.match(hints, /Never.*מעולה/)
    assert.match(hints, /human_service/)
  })

  it("bad handoff reply used celebratory opener before transfer", () => {
    assert.match(BAD_HANDOFF, /מעולה,\s+העברתי/)
    assert.match(BAD_HANDOFF, /human_service|העברתי את השיחה/)
  })
})
