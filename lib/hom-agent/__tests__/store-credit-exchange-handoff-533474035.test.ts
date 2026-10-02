import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const CREDIT_CLARIFICATION = "לא החזר כספי אלא זיכוי לקניית שטיח אחר"

function historyThroughCreditClarification(): HistoryMessage[] {
  return [
    { role: "user", content: "רוצה להחזיר את השטיח ולקנות אחר" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהבנתי. אפשר להחזיר ולקבל זיכוי או החזר כספי לפי מדיניות. על איזה הזמנה מדובר?",
    },
    { role: "user", content: "SO26023711" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמצאתי את ההזמנה SO26023711. האם להחזיר לזיכוי או להחזר כספי?",
    },
    { role: "user", content: CREDIT_CLARIFICATION },
  ]
}

/** Replay 533474035 — store credit clarification must bind מעביר to human_service. */
describe("store credit for exchange handoff (533474035)", () => {
  it("emits the store credit exchange handoff hint", () => {
    const history = historyThroughCreditClarification()
    const body = history.at(-1)?.content ?? ""
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /533474035/)
    assert.match(hints, /human_service/)
    assert.match(hints, /Never action reply/)
  })

  it("the bad reply declared transfer without human_service", () => {
    const badReply =
      "אני מעביר עכשיו לנציג שירות שיטפל בזיכוי על הזמנה SO26023711"
    assert.match(badReply, /מעביר.*נציג/)
  })
})
