import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SALES_EXCHANGE_HANDOFF =
  "*הום בוט :)*\nתודה פאני, רשמתי זה מה שיועץ המכירות יקבל:\n• מס׳ הזמנה: 78070\n• בקשת החלפה לדגם ינועה בז׳ במידה 200*290\n• סיבת ההחלפה: הגודל והצבע של השטיח שהתקבל לא התאימו\n• החלפה עם שליח בתשלום\nכרגע אין יועצי מכירות זמינים — קיבלנו את הפנייה. ניצור איתכם קשר מיד עם חזרת הצוות לזמינות."

const BAD_REPLY =
  "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. היועץ זמין עכשיו וימשיך איתך כאן."

function history339160767(): HistoryMessage[] {
  return [
    { role: "user", content: "78070" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: 78070\n• בקשת החלפה",
    },
    { role: "user", content: "החלפה לדגם ינועה בז' 200*290\nהזמנת שליח להחלפה בתשלום" },
    { role: "user", content: "גודל וצבע" },
    { role: "assistant", content: SALES_EXCHANGE_HANDOFF },
    { role: "user", content: "היי\nמחכה מכם לתשובה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. הצוות זמין עכשיו.",
    },
  ]
}

/** Replay 339160767 — sales intake exchange handoff + no-response frustration must not re-handoff. */
describe("sales exchange wait no-response (339160767)", () => {
  it("detects sales intake style exchange handoff summary", () => {
    assert.match(SALES_EXCHANGE_HANDOFF, /בקשת\s+החלפה/)
    assert.match(SALES_EXCHANGE_HANDOFF, /קיבלנו\s+את\s+הפנייה/)
  })

  it("bad reply duplicates first-time transfer prose", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה ליועץ מכירות/)
    assert.match(BAD_REPLY, /יועץ זמין עכשיו/)
  })

  it("emits sales exchange wait ping on no-response complaint — action reply not human_sales", () => {
    const body =
      "היי\nלא מבינה למה לא עונים ולא מטפלים\nממש שירות גרוע אני מקבלת מכם"
    const hints =
      buildConversationHints({
        history: history339160767(),
        body,
      }) ?? ""
    assert.match(hints, /SALES EXCHANGE WAIT PING \(532191753 \/ 339160767\)/)
    assert.match(hints, /action: reply/)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
    assert.match(hints, /NEVER duplicate.*human_sales/i)
  })

  it("emits wait ping on short chase after intake-style exchange handoff", () => {
    const hints =
      buildConversationHints({
        history: history339160767().slice(0, 6),
        body: "??",
      }) ?? ""
    assert.match(hints, /SALES EXCHANGE WAIT PING \(532191753/)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })
})
