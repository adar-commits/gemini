import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534808486 — «העברתי לנציג» with action reply left customer waiting. */
describe("return portal handoff binding (534808486)", () => {
  const falseTransferReply = `*הום בוט :)*
היי רות, מצטער שזה לא עובד בפורטל.

העברתי את השיחה לנציג שירות כדי שיפתח איתך את בקשת ההחזרה. אלה הפרטים שהוא יקבל:
• מס׳ הזמנה: 7865406
• שטיח מנדי 3, 120*170, התקבל היום
• בקשה: החזרה וביטול באיסוף שליח (85 ש״ח)
• לא מצליחה לשלוח את הבקשה בפורטל`

  it("pre-turn assigns human_service after thanks when transfer prose was not executed", () => {
    const history: HistoryMessage[] = [
      {
        role: "user",
        content: "היי אני לא מצליחה לשלוח בקשת החזרה",
      },
      { role: "assistant", content: falseTransferReply },
    ]
    const result = runPreTurnGuards({
      turn: { text: "תודה", media: [] },
      history,
      threadHistory: history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /הנציג כבר קיבל/)
  })
})
