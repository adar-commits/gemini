import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  isServiceSummaryDeliveryStatusClarification,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY =
  "*הום בוט :)* תודה על העדכון אביבה. מצטער שהשטיח עדיין לא הגיע. כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו: • מס׳ הזמנה: #76702 • הגיעו רק מדבקות • השטיח לא הגיע • במערכת המשלוח מופיע כנמסר בשליח ב-11/10 בשעה 08:17 זה מדויק, או שחסר משהו?"

const CONFIRM_WITH_CLARIFY =
  "מדויק ושיטופל בהקדם. לא הבנתי איך ציינו שנמסר"

const BAD_TRANSFER_ONLY =
  "*הום בוט :)*\nמעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

function historyThroughSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content: "נכון צפי הגעה 9.10 בגלל זה שואלת. חייבו אותי כבר בתשלום.",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* לפי המערכת, המשלוח סומן כנמסר באמצעות שליח. מה מזה הגיע אלייך בפועל?",
    },
    { role: "user", content: "רק המדבקות." },
    { role: "assistant", content: SUMMARY },
  ]
}

/** Replay 532010096 — confirm+delivery-status question must not pre-turn transfer-only. */
describe("partial delivery summary clarify (532010096)", () => {
  it("detects delivery-status clarification after service summary", () => {
    const history = historyThroughSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(
      isServiceSummaryDeliveryStatusClarification(CONFIRM_WITH_CLARIFY, history),
      true
    )
    assert.equal(
      isServiceHandoffSummaryConfirmed(CONFIRM_WITH_CLARIFY, history),
      false
    )
    assert.equal(isServiceHandoffSummaryConfirmed("מדויק", history), true)
  })

  it("pre-turn skips generic handoff for delivery-status clarification", () => {
    const result = runPreTurnGuards({
      turn: { text: CONFIRM_WITH_CLARIFY, media: [] },
      history: historyThroughSummary(),
    })
    assert.notEqual(result.kind, "handled")
  })

  it("bad reply transferred without answering how delivery was marked", () => {
    assert.doesNotMatch(BAD_TRANSFER_ONLY, /נמסר|שליח|סומן/)
  })

  it("emits delivery-status clarify hint for the LLM", () => {
    const hints =
      buildConversationHints({
        history: historyThroughSummary(),
        body: CONFIRM_WITH_CLARIFY,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY DELIVERY STATUS CLARIFY \(532010096\)/)
    assert.match(hints, /courier/)
  })
})
