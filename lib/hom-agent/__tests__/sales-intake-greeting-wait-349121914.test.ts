import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SALES_HANDOFF_SUMMARY =
  "*הום בוט :)*\nתודה לימור, רשמתי אז לסיכום, בשביל יועץ המכירות:\n• מוצר: שטיח לוטוס בצבע בז׳ (LOTUS)\n• מידות החלל: 3 על 4\n• מידת הרהיט העיקרי: 2.9\n• מתאים לבעלי חיים: כן\n• דרישות מיוחדות: קל לניקוי\n• תמונת חלל: לא נשלחה\n\nכרגע אין יועצי מכירות זמינים (שעות הפעילות א'-ה' 09:30-18:00, ו' 09:00-14:00), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

const BAD_REPLY =
  "*הום בוט :)*\nאוקיי, אז לסיכום אני מחפש עבורכם שטיח לבמידה 3 על 4 בגודל הי מתאים לבעלי חיים"

function history349121914(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח לוטוס בז' LOTUS",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי לימור! בשמחה, שטיח לוטוס בבז׳. לאיזה חלל השטיח מיועד?",
    },
    { role: "user", content: "במידה 3 על 4" },
    { role: "assistant", content: "*הום בוט :)* אוקיי, קיבלתי. מה מידת המיטה או הרהיט העיקרי בחדר?" },
    { role: "user", content: "2.9" },
    { role: "assistant", content: "*הום בוט :)* אוקיי, קיבלתי. האם אמור להתאים לבעלי חיים?" },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* אוקיי, קיבלתי. אפשר לשלוח תמונה אחת ברורה של החלל?",
    },
    { role: "user", content: "אין צורך" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* אין בעיה, נדלג על התמונה 🙂 יש דרישות מיוחדות? למשל קל לניקוי",
    },
    { role: "user", content: "קל לניקוי" },
    { role: "assistant", content: SALES_HANDOFF_SUMMARY },
    { role: "user", content: "הי" },
  ]
}

/** Replay 349121914 — bare greeting after sales intake handoff must not re-handoff or corrupt recap. */
describe("sales intake greeting wait (349121914)", () => {
  it("bad production reply wove greeting into sizes recap", () => {
    assert.match(BAD_REPLY, /בגודל\s+הי/)
    assert.match(BAD_REPLY, /לסיכום/)
  })

  it("emits sales intake callback resume forbidding duplicate human_sales on הי", () => {
    const hints =
      buildConversationHints({
        history: history349121914(),
        body: "הי",
      }) ?? ""
    assert.match(hints, /SALES INTAKE CALLBACK RESUME \(349121914\)/)
    assert.match(hints, /action: reply/)
    assert.match(hints, /NEVER.*human_sales/i)
    assert.doesNotMatch(hints, /SALES INTAKE QUIZ/)
    assert.doesNotMatch(hints, /When intake is complete, send recap \+ action human_sales/)
  })
})
