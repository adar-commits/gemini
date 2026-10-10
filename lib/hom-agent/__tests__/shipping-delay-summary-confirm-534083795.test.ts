import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildServiceRepGoalNote,
  extractServiceIntake,
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"

const SUMMARY =
  "*הום בוט :)* מבין שחיכית ושזה לוקח יותר זמן, לאה. לפי המערכת ההזמנה עדיין בתהליכי אריזה במחסן, וכשזמן האספקה עובר, נציג שירות בודק את ההזמנה אישית. כדי שהנציג לא יצטרך לשאול אותך שוב, זה מה שאעביר לו: • מס׳ הזמנה: #78309 • ההזמנה בוצעה באתר לפני 6 ימים, והסטטוס עדיין באריזה במחסן • הלקוחה מבקשת לבדוק למה השטיח עוד לא הגיע, כי לדבריה זמן האספקה (עד 4 ימי עסקים) כבר עבר זה מדויק, או שחסר משהו?"

const CONFIRM_THANKS = "כן זה מעולה תודה רבה 🙏"

function historyThroughSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "אוקיי אבל עברו כבר 6 ימים, וההזמנה אמורה להגיע תוך 4 ימי עסקים",
    },
    { role: "user", content: "זה צריך להגיע כבר" },
    { role: "assistant", content: SUMMARY },
  ]
}

/** Replay 534083795 — confirm+thanks after shipping-delay summary must not become the rep «מבקשים» line. */
describe("shipping delay summary confirm (534083795)", () => {
  it("detects pending summary and confirm with thanks", () => {
    const history = historyThroughSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(CONFIRM_THANKS, history), true)
  })

  it("does not treat praise-only confirm tail as customerGoal", () => {
    const intake = extractServiceIntake(historyThroughSummary(), CONFIRM_THANKS)
    assert.notEqual(intake.customerGoal?.trim(), "זה מעולה תודה רבה 🙏")
    const note = buildServiceRepGoalNote(intake)
    assert.doesNotMatch(note, /מבקשים:\s*זה מעולה/)
  })

  it("pre-turn human_service rep note avoids customer thanks as the request", () => {
    const result = runPreTurnGuards({
      turn: { text: CONFIRM_THANKS, media: [] },
      history: historyThroughSummary(),
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /\[שירות\]\s+מבקשים:\s*זה מעולה/)
  })
})
