import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const BOT_TRANSFER_PROSE_ONLY =
  "*הום בוט :)*\nהיי, מצטער שלא קיבלתם מענה שלושה ימים.\n\nלגבי הזיכוי: ההחזר תמיד חוזר לאמצעי התשלום המקורי, כולל כרטיס נטען של חבר. הזיכוי מתבצע עד 7 ימי עסקים ממועד ביטול העסקה.\n\nאני מעביר עכשיו לנציג שירות. הוא יבדוק את חשבונית הזיכוי ויעדכן אתכם מתי הסכום יחזור לכרטיס חבר, וגם מה המצב עם השטיח שהזמנתם ומתי הוא צפוי לחזור למלאי."

const OPENING_BODY =
  "מחכה למענה\nלא עונים לנו שלושה ימים של\nשלחו חשבונית זיכוי \nלא ברור איך תזכו כי התשלום בוצע עם כרטיס נטען של חבר\nאין מענה מאף אחד"

/** Replay 533540551 — transfer prose without human_service; thanks must bind handoff, not warm-close lie. */
describe("credit invoice handoff prose 533540551", () => {
  it("hints human_service on no-response + credit invoice opening", () => {
    const hints = buildConversationHints({
      history: [],
      body: OPENING_BODY,
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /NO RESPONSE \+ CREDIT INVOICE \(533540551\)/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /never action reply alone/)
  })

  it("thanks after unexecuted transfer prose binds human_service — not POST-HANDOFF THANKS CLOSE", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: OPENING_BODY },
      { role: "assistant", content: BOT_TRANSFER_PROSE_ONLY },
    ]
    const hints = buildConversationHints({
      history,
      body: "תודה",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /TRANSFER PROSE BIND NOW \(533540551\)/)
    assert.match(hints!, /human_service/)
    assert.doesNotMatch(hints!, /POST-HANDOFF THANKS CLOSE/)
  })
})
