import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const EXCHANGE_HANDOFF =
  "*הום בוט :)*\nבסדר גמור Noa, נמשיך עם החלפה עם שליח עוד אין לך שטיח חדש, אז יועץ מכירות יעזור לך לבחור דגם ומידה ויתאם איתך את ההחלפה עם שליח.\n• הזמנה #76132: ויקטוריאן אפור 290*200\n• ההחלפה: דגם ומידה אחרים, עם שליח\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

const BAD_REPLY =
  "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history530723343(): HistoryMessage[] {
  return [
    { role: "user", content: "החלפה עם שליח" },
    { role: "assistant", content: EXCHANGE_HANDOFF },
    { role: "user", content: "אוקיי" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nNoa, בשמחה! הנציג כבר קיבל את הפנייה ויצור קשר בהקדם.",
    },
    { role: "user", content: "היי לא התקשרו אליי" },
    { role: "user", content: "??" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nסליחה על ההמתנה Noa — הבקשה שלך להחלפה עם שליח בהזמנה #76132 ממתינה ליועץ מכירות.",
    },
  ]
}

/** Replay 530723343 — sales exchange handoff + callback ETA question must not re-handoff. */
describe("sales exchange callback eta (530723343)", () => {
  it("detects courier exchange handoff summary in thread", () => {
    assert.match(EXCHANGE_HANDOFF, /החלפה\s+עם\s+שליח/)
    assert.match(EXCHANGE_HANDOFF, /העברתי את השיחה ליועץ מכירות/)
  })

  it("bad reply duplicates transfer after SLA question", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה ליועץ מכירות/)
  })

  it("emits sales exchange wait ping on callback timing — action reply not human_sales", () => {
    const body = "תוך כמה זמן הוא יחזור?"
    const hints =
      buildConversationHints({
        history: history530723343(),
        body,
      }) ?? ""
    assert.match(hints, /SALES EXCHANGE WAIT PING \(532191753 \/ 339160767 \/ 530723343\)/)
    assert.match(hints, /action: reply/)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })
})
