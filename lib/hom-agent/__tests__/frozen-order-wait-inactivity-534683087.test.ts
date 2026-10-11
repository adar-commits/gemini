import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipInactivityForHumanWait } from "@/lib/agents/human-waiting"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_TRANSFER =
  "*הום בוט :)*\nמבין שחיכית. הסטטוס בביצוע וההזמנה מוקפאת. אני מעביר עכשיו לנציג שירות."

const BOT_THANKS_ACK =
  "*הום בוט :)*\nLia, בשמחה! הנציג כבר קיבל את הפנייה ויצור קשר בהקדם."

const INACTIVITY_PING = "*הום בוט :)*\nLia, עדיין כאן?"

function historyThroughInactivityPing(): HistoryMessage[] {
  return [
    { role: "user", content: "הזמנה #77326" },
    { role: "assistant", content: "*הום בוט :)* מצאתי הזמנה. זו ההזמנה?" },
    { role: "user", content: "כן. למה לא קיבלנו את הפריט?" },
    { role: "assistant", content: "*הום בוט :)* סטטוס בביצוע." },
    { role: "user", content: "עברו הרבה מעבר ל-4 ימי עסקים" },
    { role: "assistant", content: BOT_TRANSFER },
    { role: "user", content: "תודה. מחכה להתייחasות" },
    { role: "assistant", content: BOT_THANKS_ACK },
    { role: "assistant", content: INACTIVITY_PING },
  ]
}

/** Replay 534683087 — post-handoff wait must skip ping and bind inactivity כן to rep wait. */
describe("frozen order wait inactivity 534683087", () => {
  it("skips inactivity when rep-waiting ack is last meaningful reply", () => {
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "reply",
        lastAssistantText: BOT_THANKS_ACK,
        history: historyThroughInactivityPing(),
      }),
      true
    )
  })

  it("emits post-handoff inactivity hint instead of generic still-here ack", () => {
    const hints =
      buildConversationHints({
        history: historyThroughInactivityPing(),
        body: "כן",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF INACTIVITY \(533540551\)/)
    assert.doesNotMatch(hints, /INACTIVITY STILL-HERE ACK/)
  })

  it("binds SLA breach escalation to human_service on policy pushback", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "הזמנה קיימת, מספר הזמנה: #77326" },
      { role: "assistant", content: "*הום בוט :)* לא מצאתי את ההזמנה על הטלפון." },
      { role: "user", content: "052-3848847" },
      {
        role: "assistant",
        content: "*הום בוט :)* מצאתי הזמנה. זו ההזמנה? (מס׳ הזמנה ⁦#77326⁩)",
      },
      { role: "user", content: "כן. למה אנחנו לא קיבלנו עוד את הפריט?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)* בדקתי, סטטוס ההזמנה במערכת: בביצוע. לפי מדיניות האספקה: עד 4 ימי עסקים.",
      },
    ]
    const hints =
      buildConversationHints({
        history,
        body: "עברו הרבה מעבר ל-4 ימי עסקים אם לא עמדתם במדיניות האספקה, מה זה אומר?",
      }) ?? ""
    assert.match(hints, /SLA BREACH SHIPPING ESCALATION \(534683087\)/)
    assert.match(hints, /human_service/)
  })
})
