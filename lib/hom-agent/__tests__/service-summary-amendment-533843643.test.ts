import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const SUMMARY =
  "*הום בוט :)* כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו: • מס׳ הזמנה: SO26023279 • פנייה לשירות לקוחות • מטרת הפנייה: הגיע Sora 02 במקום, חסר שטיח מההזמנה זה מדויק, או שחסר משהו?"

const AMENDMENT =
  "אנא תוסיף שהלקוח מבקש לדעת מתי יסופקו כי זה כבר נהיה ממש התנהלות לא טובה של השטיח האדום. מבאס ממש."

function historyThroughSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "כן, זו ההזמנה. הגיע שטיח Sora 02 במקום. בנוסף, לא סופק לנו שטיח אחר מאותה הזמנה.",
    },
    {
      role: "assistant",
      content: SUMMARY,
      awaiting: "service_summary_confirm",
    },
  ]
}

/** Replay 533843643 — «תוסיף לסיכום» before confirm must update recap, not off-hours handoff. */
describe("service summary amendment (533843643)", () => {
  it("detects pending summary and amendment is not bare confirm", () => {
    const history = historyThroughSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(AMENDMENT, history), false)
  })

  it("emits amendment hint — reply recap, not human_service", () => {
    const hints =
      buildConversationHints({
        history: historyThroughSummary(),
        body: AMENDMENT,
      }) ?? ""
    assert.match(hints, /SERVICE SUMMARY AMENDMENT \(533843643\)/)
    assert.match(hints, /action reply/)
    assert.match(hints, /NEVER human_service/)
    assert.doesNotMatch(hints, /AFTER-HOURS HANDOFF: reps are offline/)
  })
})
