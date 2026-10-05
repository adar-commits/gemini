import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  isServiceSummaryOrderReferenceClarification,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const ORDER_CONFIRM =
  "*הום בוט :)*\nהיי שירי, מצטער לשמוע. קיבלתי את התמונה: רואים בה נקודה לאורך השוליים שבה הגימור נראה פתוח ולא רציף. נעביר את זה לנציג שירות שיבדוק ויציע פתרון. כדי לפתוח את הפנייה על ההזמנה הנכונה: מדובר בהזמנה SO26024293 מהקישור למעקב?"

const SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦#77990⁩\n• דיווח על בעיה / חשש לגבי המוצר (לפי הלקוח)\n\nזה מדויק, או שחסר משהו?"

const CLARIFY =
  "כן. מה זה מספר ההזמנה ? שלחת לי משהו אחר קודם"

function historyThroughSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי, קיבלתי עכשיו את השטיח ולדעתי יש בו פגם בגימור של השוליים",
    },
    { role: "assistant", content: ORDER_CONFIRM },
    { role: "user", content: "כן" },
    { role: "assistant", content: SUMMARY },
  ]
}

/** Replay 354673370 — confirm+order-id question must not trigger human_service pre-turn. */
describe("service order id clarify (354673370)", () => {
  it("detects service summary pending and order-id clarification", () => {
    const history = historyThroughSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceSummaryOrderReferenceClarification(CLARIFY, history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(CLARIFY, history), false)
    assert.equal(isServiceHandoffSummaryConfirmed("כן", history), true)
  })

  it("pre-turn skips handoff for order-id clarification", () => {
    const result = runPreTurnGuards({
      turn: { text: CLARIFY, media: [] },
      history: historyThroughSummary(),
    })
    assert.notEqual(result.kind, "handled")
    if (result.kind === "handled") {
      assert.notEqual(result.action, "human_service")
    }
  })

  it("emits order-id clarify hint for the LLM", () => {
    const hints =
      buildConversationHints({
        history: historyThroughSummary(),
        body: CLARIFY,
      }) ?? ""
    assert.match(hints, /SERVICE ORDER ID CLARIFY \(354673370\)/)
    assert.match(hints, /same order/)
  })
})
