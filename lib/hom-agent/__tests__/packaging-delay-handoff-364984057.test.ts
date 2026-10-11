import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING_BODY =
  "ארוזה\nכבר שבוע ומשהו\nבאמת\nקק אקיזה\nאיך"

const BOT_TRANSFER_PROSE_ONLY =
  "*הום בוט :)*\nמבין שאת מחכה כבר יותר משבוע, וזה מתסכל. לפי המערכת ההזמנה עדיין בתהליכי אריזה במחסן, ואין לי כאן תאריך משלוח מדויק. מעביר אותך עכשיו לנציג שירות. הוא יבדוק את ההזמנה מהתמונה ששלחת ויעדכן אותך מתי היא צפויה לצאת."

/** Replay 364984057 — declarative מעביר on packaging delay must bind human_service on the opening turn. */
describe("packaging delay handoff prose 364984057", () => {
  it("hints human_service on packaging + week-wait opening", () => {
    const hints = buildConversationHints({
      history: [],
      body: OPENING_BODY,
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PACKAGING DELAY ESCALATION \(364984057\)/)
    assert.match(hints!, /action: human_service/)
    assert.match(hints!, /never `action: reply` with declarative מעביר/)
  })

  it("follow-up after unexecuted transfer prose still binds human_service", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: OPENING_BODY },
      { role: "assistant", content: BOT_TRANSFER_PROSE_ONLY },
    ]
    const hints = buildConversationHints({
      history,
      body: "אוקי\nההזמנה השניה נעשתה בשישי\nאז בסדר",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /human_service/)
    assert.match(hints!, /ASSIGNMENT TRUTH \(278792620\)|PACKAGING DELAY ESCALATION/)
  })
})
