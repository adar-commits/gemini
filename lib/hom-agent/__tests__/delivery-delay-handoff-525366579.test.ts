import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPureHandoffAffirmation } from "@/lib/agents/compound-reply"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 525366579 — delivery delay, handoff offer, כן אשמח תודה רבה. */
describe("delivery delay handoff confirm (525366579)", () => {
  const handoffOffer = `*הום בוט :)*
היי אורלי, מכאן אני לא יכול לדחות את המשלוח, כי בקשות לתאריך מסוים לא נרשמות מראש במערכת. חברת השליחויות יוצרת קשר ביום האספקה עצמו לפני שהיא מגיעה. נציג שירות יכול לבדוק אם אפשר לדחות לשבוע הבא. להעביר אלייך נציג?`

  const history: HistoryMessage[] = [
    {
      role: "user",
      content:
        "הי, קיבלתי הודעה שמשלוח השטיחים יגיע מחר. האם יש אפשרות לדחות לשבוע הבא?",
    },
    { role: "assistant", content: handoffOffer },
  ]

  it("treats כן, אשמח, תודה רבה as pure handoff confirm", () => {
    assert.equal(isPureHandoffAffirmation("כן, אשמח, תודה רבה"), true)
  })

  it("pre-turn binds confirm to human_service — not thanks ack", () => {
    assert.equal(isHumanHandoffPending(history), true)
    const result = runPreTurnGuards({
      turn: { text: "כן, אשמח, תודה רבה", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /נציג|שירות/)
    assert.doesNotMatch(result.reply, /אם תרצו שאעביר/)
  })
})
