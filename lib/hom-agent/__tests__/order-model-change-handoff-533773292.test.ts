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
  "*הום בוט :)* כדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו: • מס׳ הזמנה: #77992 • פנייה לשירות לקוחות זה מדויק, או שחסר משהו?"

function historyThroughSummary(): HistoryMessage[] {
  return [
    {
      role: "user",
      content:
        "היי מה נשמע? ממש עכשיו עשיתי הזמנה של השטיח הזה והתכוונו להזמין בכלל את הצבע האחר של אותו דגם, יש אפשרות לשנות כבר עכשיו את ההזמנה? הזמנה על שם שי שפס",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-6049848) אם לא, אשמח לקבל אותו.",
    },
    { role: "user", content: "לא המספר הנכון הוא 0544801976" },
    {
      role: "assistant",
      content: "*הום בוט :)* אני על זה, כמה רגעים בבקשה 🙏",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה היום באתר אינטרנט, על סך 263 ש״ח. זו ההזמנה? (מס׳ הזמנה #77992)",
    },
    { role: "user", content: "כן" },
    { role: "assistant", content: SUMMARY },
  ]
}

const CONFIRM_WITH_ADDITION = "כן ולהוסיף שינוי דגם של הזמנה"

/** Replay 533773292 — service summary confirm+addition must hand off, not close. */
describe("order model change handoff (533773292)", () => {
  it("detects service summary pending and confirm with addition", () => {
    const history = historyThroughSummary()
    assert.equal(isServiceHandoffSummaryPending(history), true)
    assert.equal(isServiceHandoffSummaryConfirmed(CONFIRM_WITH_ADDITION), true)
  })

  it("captures the model-change addition for the rep note", () => {
    const intake = extractServiceIntake(historyThroughSummary(), CONFIRM_WITH_ADDITION)
    assert.match(intake.customerGoal ?? "", /שינוי\s+דגם/)
    assert.match(buildServiceRepGoalNote(intake), /שינוי\s+דגם/)
  })

  it("pre-turn assigns human_service — never a warm close", () => {
    const result = runPreTurnGuards({
      turn: { text: CONFIRM_WITH_ADDITION, media: [] },
      history: historyThroughSummary(),
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /טופל|שמחתי לעזור/)
    assert.match(result.reply, /נציג|שירות/)
    assert.match(result.reply, /שינוי\s+דגם/)
  })
})
