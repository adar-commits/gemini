import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryRepeatRefinement,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const REFINEMENT = "בכריות יש פגמים, חוט שיוצא, חוט שנמשך וכו"

const UPDATED_SUMMARY = `*הום בוט :)*
תודה עופר, עדכנתי את התיאור במילים שלך. זה מה שאעביר לנציג השירות:
• מס׳ הזמנה: SO26024356
• דיווח על בעיה (לפי הלקוח): בכריות יש פגמים
• נשלחו תמונות
עכשיו זה מדויק?`

const FIRST_SUMMARY = `*הום בוט :)*
כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:
• מס׳ הזמנה: SO26024356
• נשלחו תמונות
זה מדויק, או שחסר משהו?`

function historyThroughUpdatedSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "שלום, הגיע אלי משלוח של כריות ויש פגמים [תמונה]",
    },
    { role: "assistant", content: FIRST_SUMMARY, awaiting: "service_summary_confirm" },
    { role: "user", content: "מה לגבי הכריות? תודה" },
    { role: "assistant", content: UPDATED_SUMMARY, awaiting: "service_summary_confirm" },
  ]
}

/** Replay 533801731 — after updated recap, another defect refinement must hand off, not re-ask מדויק. */
describe("pillow defect repeat refinement (533801731)", () => {
  it("detects repeat refinement after עדכנתי recap", () => {
    const history = historyThroughUpdatedSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(REFINEMENT, history), false)
    assert.equal(isServiceHandoffSummaryRepeatRefinement(REFINEMENT, history), true)
  })

  it("bad third reply re-asked מדויק instead of human_service", () => {
    assert.match(UPDATED_SUMMARY, /עכשיו.*מדויק\?/)
  })

  it("emits repeat refinement hint to hand off immediately", () => {
    const hints =
      buildConversationHints({
        history: historyThroughUpdatedSummary(),
        body: REFINEMENT,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY REPEAT REFINEMENT \(533801731\)/)
    assert.match(hints, /human_service NOW/)
  })
})
