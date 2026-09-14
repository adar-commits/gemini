import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPureHandoffAffirmation } from "@/lib/agents/compound-reply"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 532074359 / 0526105801 — invoice copy, getDocument not found, handoff confirm. */
describe("document handoff bare כן (532074359)", () => {
  const notFoundHandoff = `*הום בוט :)*
לא מצאתי מסמך דיגיטלי לפי הטלפון הזה.
האם להעביר לנציג שירות שיבדוק וישלח עבורכם?`

  const history: HistoryMessage[] = [
    { role: "user", content: "היי אשמח לעזרתכם" },
    { role: "assistant", content: "היי! 😊" },
    { role: "user", content: "אני צריכה בבקשה חשבונית" },
    {
      role: "assistant",
      content: "איזה סוג חשבונית?\n1. חשבונית מס\n2. חשבונית מס קבלה",
    },
    { role: "user", content: "2" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (052-6105801)\nאם לא, אשמח לקבל את המספר הנכון.",
    },
    {
      role: "assistant",
      content: "*הום בוט :)*\nאני על זה, כמה רגעים בבקשה 🙏",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: notFoundHandoff },
  ]

  it("treats bare כן as handoff confirm", () => {
    assert.equal(isPureHandoffAffirmation("כן"), true)
  })

  it("pre-turn binds bare כן to human_service", () => {
    assert.equal(isHumanHandoffPending(history), true)
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /האם\s+העסקה\s+רשומה/)
  })

  it("hints block duplicate phone lookup after document not found", () => {
    const hints = buildConversationHints({ history, body: "כן" })
    assert.ok(hints)
    assert.match(hints, /DOCUMENT HANDOFF PENDING/i)
    assert.match(hints, /never re-ask.*האם העסקה/i)
  })
})
