import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  combineMultiQuestionReply,
  looksLikeMultipleQuestions,
  orderQuestionsByPriority,
  pickPrimaryQuestion,
} from "@/lib/agents/multi-question"
import type { HistoryMessage } from "@/lib/agents/types"

const emptyHistory: HistoryMessage[] = []

describe("multi-question helpers (v3)", () => {
  it("detects council multi-Q example", () => {
    assert.equal(
      looksLikeMultipleQuestions("מתי מגיע המשלוח? וגם איזה סניפים יש?"),
      true
    )
  })

  it("pickPrimaryQuestion prioritizes shipping over branch FAQ", () => {
    const questions = ["איזה סניפים יש?", "איפה המשלוח שלי?"]
    assert.equal(pickPrimaryQuestion(questions, emptyHistory), "איפה המשלוח שלי?")
  })

  it("pickPrimaryQuestion prioritizes handoff yes when pending", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "האם להעביר את הפנייה כעת ליועץ מכירות?",
        agent: "faq",
      },
    ]
    const questions = ["איזה סניפים יש?", "כן בבקשה"]
    assert.equal(pickPrimaryQuestion(questions, history), "כן בבקשה")
  })

  it("orderQuestionsByPriority puts primary first", () => {
    const questions = ["איזה סניפים יש?", "איפה המשלוח שלי?"]
    const ordered = orderQuestionsByPriority(questions, emptyHistory)
    assert.deepEqual(ordered, ["איפה המשלוח שלי?", "איזה סניפים יש?"])
  })
})

describe("combineMultiQuestionReply", () => {
  it("merges parts into one header block", () => {
    const combined = combineMultiQuestionReply([
      "משלוחים לוקחים 7-14 ימים",
      "יש לנו סניפים ברחבי הארץ",
    ])
    assert.match(combined, /^\*הום בוט :\)\*/)
    assert.match(combined, /משלוחים/)
    assert.match(combined, /סניפים/)
  })

  it("dedupes identical paragraphs", () => {
    const combined = combineMultiQuestionReply([
      "משלוח חינם מעל 500 ש״ח",
      "משלוח חינם מעל 500 ש״ח",
      "יש החזרות דרך האתר",
    ])
    const body = combined.replace(/^\*הום בוט :\)\*\n?/, "")
    assert.equal(body.split("משלוח חינם").length - 1, 1)
  })
})
