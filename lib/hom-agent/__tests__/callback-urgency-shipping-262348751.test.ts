import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/** 262348751 — urgent callback on open shipping thread → service, not stale sales summary. */
describe("callback urgency + shipping (262348751)", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מתי יגיע השטיח שהזמנתי?" },
    { role: "assistant", content: "סטטוס: בדרך — השליח יתאם הגעה." },
    {
      role: "assistant",
      content: "אז לסיכום — מחפשים שטיח לסלון… אני צודק?",
    },
  ]

  it("hints service handoff and suppresses stale sales recap", () => {
    const hints = buildConversationHints({
      history,
      body: "דחוף!!! תתקשרו אליי עכשיו, עדיין לא קיבלתי!!!",
      whatsappPhone: "+972501234567",
    })
    assert.match(hints ?? "", /262348751|CALLBACK URGENCY/i)
    assert.match(hints ?? "", /STALE SALES SUMMARY|human_service/i)
  })
})
