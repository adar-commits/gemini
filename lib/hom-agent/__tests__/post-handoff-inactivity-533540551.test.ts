import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING_BODY =
  "מחכה למענה\nלא עונים לנו שלושה ימים של\nשלחו חשבונית זיכוי \nלא ברור איך תזכו כי התשלום בוצע עם כרטיס נטען של חבר\nאין מענה מאף אחד"

const BOT_TRANSFER =
  "*הום בוט :)*\nהיי, מצטער שלא קיבלתם מענה שלושה ימים.\n\nלגבי הזיכוי: ההחזר תמיד חוזר לאמצעי התשלום המקורי, כולל כרטיס נטען של חבר. הזיכוי מתבצע עד 7 ימי עסקים ממועד ביטול העסקה.\n\nאני מעביר עכשיו לנציג שירות. הוא יבדוק את חשבונית הזיכוי ויעדכן אתכם מתי הסכום יחזור לכרטיס חבר, וגם מה המצב עם השטיח שהזמנתם ומתי הוא צפוי לחזור למלאי."

const BOT_THANKS_ACK =
  "*הום בוט :)*\nגאיה, בשמחה! 😊 הנציג כבר קיבל את הפנייה ויצור קשר בהקדם."

const INACTIVITY_PING = "*הום בוט :)*\nגאיה, עדיין כאן?"

function historyThroughInactivityPing(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING_BODY },
    { role: "assistant", content: BOT_TRANSFER },
    { role: "user", content: "תודה" },
    { role: "assistant", content: BOT_THANKS_ACK },
    { role: "assistant", content: INACTIVITY_PING },
  ]
}

/** Replay 533540551 — post-handoff inactivity כן must not reopen generic intake. */
describe("post-handoff inactivity still-here 533540551", () => {
  it("emits post-handoff inactivity hint instead of generic still-here ack", () => {
    const hints =
      buildConversationHints({
        history: historyThroughInactivityPing(),
        body: "כן",
      }) ?? ""
    assert.match(hints, /POST-HANDOFF INACTIVITY \(533540551\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /INACTIVITY STILL-HERE ACK/)
    assert.match(hints, /never "איך אוכל להמשיך לעזור\?"/)
  })
})
