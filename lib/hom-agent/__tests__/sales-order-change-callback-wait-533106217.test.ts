import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const ORDER_CHANGE_HANDOFF =
  "*הום בוט :)*\nהיי דודי! ההזמנה (#77430, פנסי בז 230*160) עדיין בהזמנה מוקדמת ולא נשלחה, אז זה זמן טוב לבדוק שינוי מידה. יועץ מכירות יבדוק אם יש את פנסי בז במידה קטנה יותר ומה זה אומר על המחיר ועל מועד האספקה, ויעדכן את ההזמנה. אני מעביר אותך אליו עכשיו\n\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

const BAD_REPLY =
  "*הום בוט :)*\nמעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."

function history533106217(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "היי אשמח לדעת אם יש אופציה לשנות את ההזמנה למידה אחת קטנה יותר של השטיח🙏",
    },
    { role: "assistant", content: ORDER_CHANGE_HANDOFF },
    { role: "user", content: "תודה רבה אני ממתינה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nדודי חמו משרד עורכי דין, בשמחה! 😊 הנציג כבר קיבל את הפנייה ויצור קשר בהקדם.",
    },
    { role: "user", content: "תודה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nדודי חמו משרד עורכי דין, בשמחה! 😊 הנציג כבר קיבל את הפנייה ויצור קשר בהקדם.",
    },
    { role: "user", content: "היי מתי יצרו איתי קשר" },
  ]
}

/** Replay 533106217 — order size change sales handoff + callback chase must not re-handoff. */
describe("sales order change callback wait (533106217)", () => {
  it("detects order change handoff summary in thread", () => {
    assert.match(ORDER_CHANGE_HANDOFF, /שינוי\s+מידה/)
    assert.match(ORDER_CHANGE_HANDOFF, /יועץ\s+מכירות/)
  })

  it("bad reply duplicates transfer after callback chase", () => {
    assert.match(BAD_REPLY, /העברתי את השיחה ליועץ מכירות/)
  })

  it("emits sales order change wait ping on timing question — action reply not human_sales", () => {
    const body = "היי מתי יצרו איתי קשר"
    const hints =
      buildConversationHints({
        history: history533106217(),
        body,
      }) ?? ""
    assert.match(hints, /SALES ORDER CHANGE WAIT PING \(533106217/)
    assert.match(hints, /action: reply/)
    assert.doesNotMatch(hints, /POST-HANDOFF NO-RESPONSE RE-ESCALATION/)
  })

  it("emits wait ping on urgent callback ask with ??", () => {
    const body = "??\nאשמח שיחזרו אלי בהקדם בבקשה"
    const hints =
      buildConversationHints({
        history: history533106217(),
        body,
      }) ?? ""
    assert.match(hints, /SALES ORDER CHANGE WAIT PING \(533106217/)
    assert.match(hints, /action: reply/)
  })
})
