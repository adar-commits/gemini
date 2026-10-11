import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const LOOKUP_FAIL_OFFER =
  "*הום בוט :)* נראה שיש תקלה זמנית במערכת — לא הצלחתי למשוך את המידע כרגע. האם להעביר לנציג שירות שיבדוק עבורכם?"

function history534415948(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, רציתי לברר אם הסטטוס של ״ההזמנה בדרך״ אומר שההזמנה תגיע היום.",
    },
    { role: "assistant", content: LOOKUP_FAIL_OFFER },
  ]
}

/** Replay 534415948 — «אין בעיה» after lookup-failure handoff offer. */
describe("handoff ain baya 534415948", () => {
  it("hints handoff pending — not non-confirm FAQ pivot", () => {
    const hints =
      buildConversationHints({
        history: history534415948(),
        body: "אין בעיה 💕",
      }) ?? ""
    assert.match(hints, /HANDOFF OFFER PENDING/)
    assert.doesNotMatch(hints, /HANDOFF OFFER — NON-CONFIRM REPLY/)
    assert.match(hints, /never.*הזמנה בדרך/i)
    assert.match(hints, /AFTER-HOURS SHIPPING HANDOFF CONFIRM \(534415948\)/)
  })
})
