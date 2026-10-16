import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceTransferWordingAction,
  hasDeclarativeHandoffTransfer,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { hasDeclarativeHandoffTransferInText } from "@/lib/agents/post-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 534808486 — portal return handoff said העברתי but action stayed reply. */
describe("portal handoff action 534808486", () => {
  const handoffReply = `*הום בוט :)*
היי רות, מצטער שזה לא עובד בפורטל. העברתי את השיחה לנציג שירות כדי שיפתח איתך את בקשת ההחזרה. אלה הפרטים שהוא יקבל:
• מס׳ הזמנה: 7865406
• שטיח מנדי 3, 120*170, התקבל היום
• בקשה: החזרה וביטול באיסוף שליח (85 ש״ח)
• לא מצליחה לשלוח את הבקשה בפורטל`

  it("detects past-tense העברתי את השיחה as declarative transfer", () => {
    assert.equal(hasDeclarativeHandoffTransferInText(handoffReply), true)
    assert.equal(hasDeclarativeHandoffTransfer(handoffReply), true)
  })

  it("coerces reply action to human_service when transfer is committed", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי אני לא מצליחה לשלוח בקשת החזרה" },
    ]
    const coerced = coerceTransferWordingAction(
      { reply: handoffReply, action: "reply" },
      history
    )
    assert.equal(coerced.action, "human_service")
  })

  it("marks thread handoff-pending after transfer prose (thanks must not fake assign)", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי אני לא מצליחה לשלוח בקשת החזרה" },
      { role: "assistant", content: handoffReply },
    ]
    assert.equal(isHumanHandoffPending(history), true)
  })
})
