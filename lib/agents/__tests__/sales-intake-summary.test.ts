import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildConfirmationSummary,
  buildSalesIntakeReply,
  extractSalesIntake,
} from "@/lib/agents/sales-intake"

describe("buildConfirmationSummary", () => {
  it("uses בכל סגנון for no-preference style answers", () => {
    const intake = extractSalesIntake(
      [
        { role: "assistant", content: "איזה סגנון או תחושה מחפשים?", agent: "sales" },
      ],
      "האמת שאין לי מושג"
    )
    intake.product = "שטיח"
    intake.targetSpace = "חדר שינה"
    intake.pets = "yes"

    const summary = buildConfirmationSummary(intake)
    assert.match(summary, /בכל סגנון/)
    assert.doesNotMatch(summary, /אין לי מושג/)
  })

  it("omits bogus browsing text as a requested model", () => {
    const intake = extractSalesIntake([], "מחפש שטיח באינטרנט אבל לא מסתדר כל כך לחדר שינה")
    intake.product = "שטיח"
    intake.targetSpace = "חדר שינה"
    intake.pets = "yes"
    intake.practicalNeeds = "אשמח שיהיה קל לניקוי אבל לא קריטי"
    intake.budget = "6000"

    const summary = buildConfirmationSummary(intake)
    assert.match(summary, /מתאים לבעלי חיים/)
    assert.match(summary, /קל לניקוי/)
    assert.doesNotMatch(summary, /באינטרנט/)
    assert.doesNotMatch(summary, /עניין בדגם/)
  })

  it("does not ask budget during intake flow", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "*הום בוט :)*\nאיזה סגנון או תחושה מחפשים — יוקרתי, מודרני, כפרי, או משהו אחר?",
        agent: "sales",
      },
    ]
    const reply = buildSalesIntakeReply(history, "יוקרתי")
    assert.doesNotMatch(reply, /תקציב/)
  })

  it("asks sofa size before pets when living room is known", () => {
    const reply = buildSalesIntakeReply([], "היי אני מחפש שטיח לסלון")
    assert.match(reply, /מידת הספה|גודל כללי של הסלון/)
    assert.doesNotMatch(reply, /בעלי חיים/)
  })

  it("does not put placeholder unknown size in confirmation summary", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "מחפש שטיח לסלון", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
        agent: "sales",
      },
      { role: "user", content: "כן", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
        agent: "sales",
      },
      { role: "user", content: "כן", agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאיזה סגנון או תחושה מחפשים — יוקרתי, מודרני, כפרי, או משהו אחר? יש צבע שאהוב?",
        agent: "sales",
      },
    ]

    const reply = buildSalesIntakeReply(history, "בז' או קרם, לא יודע מודרני")
    assert.doesNotMatch(reply, /לא ידוע/)
    assert.doesNotMatch(reply, /יועץ יבדוק/)
    assert.match(reply, /בז/)
  })
})
