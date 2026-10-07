import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FIRST_SUMMARY =
  "*הום בוט :)*\nתודה מאור, הבנתי. כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• טלפון: 052-6660670\n• השטיח הגיע היום\n• דיווח על בעיה / חשש (לפי הלקוח): שתי נקודות קשורות באמצע השטיח\n• נשלחה תמונה\n• מס׳ הזמנה: עדיין לא אותר\nזה מדויק, או שחסר משהו?"

const CORRECTION = "לא קשורות לא קשור באמצע השטיח שתי נקודות"

const BAD_SECOND_SUMMARY =
  "*הום בוט :)*\nסליחה מאור, תיקנתי. זה מה שאעביר לנציג:\n• טלפון: 052-6660670\n• השטיח הגיע היום\n• דיווח על בעיה / חשש (לפי הלקוח): שתי נקודות לא קשורות באמצע השטיח\n• נשלחה תמונה\n• מס׳ הזמנה: עוד לא אותר\nעכשיו זhe מדויק?"

function historyThroughFirstSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי היום קיבלתי את השטיח עכשיו אני פותח אותו יש דפקט בשטיח [תמונה]",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי מאור, מצטער לשמוע… אפשר לפרט בכמה מילים מה הבעיה?",
    },
    { role: "user", content: "שלחתי תמונה שתי נקודות של קשורות באמצע השטיח" },
    {
      role: "assistant",
      content: FIRST_SUMMARY,
      awaiting: "service_summary_confirm",
    },
  ]
}

/** Replay 533667546 — dots vs threads correction must hand off, not re-ask מדויק. */
describe("dots not threads service summary (533667546)", () => {
  it("detects summary pending and treats dots correction as not confirm", () => {
    const history = historyThroughFirstSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(CORRECTION, history), false)
  })

  it("first summary wrongly used קשורות instead of נקודות", () => {
    assert.match(FIRST_SUMMARY, /קשורות/)
    assert.doesNotMatch(FIRST_SUMMARY, /לא קשירות/)
  })

  it("bad second reply still re-asked מדויק instead of human_service", () => {
    assert.match(BAD_SECOND_SUMMARY, /עכשיו.*מדויק\?/)
  })

  it("emits dots correction hint to hand off immediately", () => {
    const hints =
      buildConversationHints({
        history: historyThroughFirstSummary(),
        body: CORRECTION,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY DOTS CORRECTION \(533667546\)/)
    assert.match(hints, /human_service NOW/)
    assert.match(hints, /never «קשורות»/)
  })
})
