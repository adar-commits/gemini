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
        { role: "assistant", content: "איזה סגנון מדבר אליכם? מודרני, בוהו, מינימליסטי, קלאסי/וינטג' או שניתן ליועץ להחליט?" },
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

  it("does not ask budget — asks special requirements after style in full intake", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אני רוצה לקנות שטיח לסלון", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
        agent: "sales",
      },
      { role: "user", content: "2 על 3 כנראה", agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
        agent: "sales",
      },
      { role: "user", content: "לא", agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאפשר לשלוח תמונה של החלל? זה יעזור ליועץ העיצוב.",
        agent: "sales",
      },
      { role: "user", content: "אין לי תמונה", agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאיזה סגנון מדבר אליכם? מודרני, בוהו, מינימליסטי, קלאסי/וינטג' או שניתן ליועץ להחליט?",
        agent: "sales",
      },
    ]
    const reply = buildSalesIntakeReply(history, "מעדיף ייעוץ")
    assert.doesNotMatch(reply, /תקציב/)
    assert.match(reply, /דרישות מיוחדות|קל לניקוי|בעלי חיים/)
  })

  it("asks for room photo before style after pets", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שטיח לסלון", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
        agent: "sales",
      },
      { role: "user", content: "2 על 3", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
        agent: "sales",
      },
      { role: "user", content: "לא", agent: null },
    ]
    const reply = buildSalesIntakeReply(history, "")
    assert.match(reply, /תמונה.*יועץ העיצוב/)
    assert.doesNotMatch(reply, /מודרני.*בוהו/)
  })

  it("shows style fallback when customer has no photo", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שטיח לסלון", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
        agent: "sales",
      },
      { role: "user", content: "2 על 3", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
        agent: "sales",
      },
      { role: "user", content: "לא", agent: null },
      {
        role: "assistant",
        content: "*הום בוט :)*\nאפשר לשלוח תמונה של החלל? זה יעזור ליועץ העיצוב.",
        agent: "sales",
      },
    ]
    const reply = buildSalesIntakeReply(history, "אין לי תמונה")
    assert.match(reply, /מודרני.*בוהו.*מינימליסטי/)
    assert.match(reply, /יועץ להחליט/)
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
          "*הום בוט :)*\nאיזה סגנון מדבר אליכם? מודרני, בוהו, מינימליסטי, קלאסי/וינטג' או שניתן ליועץ להחליט?",
        agent: "sales",
      },
    ]

    const reply = buildSalesIntakeReply(history, "בז' או קרם, לא יודע מודרני")
    assert.doesNotMatch(reply, /לא ידוע/)
    assert.doesNotMatch(reply, /יועץ יבדוק/)
    assert.match(reply, /בז/)
  })
})
