import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { confidentSkipMasterRoute } from "@/lib/agent-core/confident-route"
import { guessMasterRoute } from "@/lib/agents/route-intent"
import {
  combineMultiQuestionReply,
  looksLikeMultipleQuestions,
  orderQuestionsByPriority,
  pickPrimaryQuestion,
} from "@/lib/agents/multi-question"
import type { HistoryMessage } from "@/lib/agents/types"

const emptyHistory: HistoryMessage[] = []

describe("confidentSkipMasterRoute (council fixtures)", () => {
  it("#5 shipping status skips master", () => {
    const route = confidentSkipMasterRoute("איפה המשלוח שלי", emptyHistory)
    assert.equal(route?.kind, "shipping_status")
    assert.equal(route?.action, "ROUTE_TO_SHIPPING_STATUS")
  })

  it("#13 sales consultation skips master", () => {
    const route = confidentSkipMasterRoute("רוצה לקנות שטיח לסלון", emptyHistory)
    assert.equal(route?.kind, "sales")
    assert.equal(route?.action, "ROUTE_TO_SALES_AGENT")
  })

  it("#14 document request skips master", () => {
    const route = confidentSkipMasterRoute("שלחו לי קבלה", emptyHistory)
    assert.equal(route?.kind, "document")
    assert.equal(route?.action, "ROUTE_TO_SHIPPING_STATUS")
  })

  it("#8 defect complaint does not use T1 allowlist", () => {
    assert.equal(
      confidentSkipMasterRoute("השטיח הגיע קרוע", emptyHistory),
      null
    )
    assert.equal(guessMasterRoute("השטיח הגיע קרוע"), "ROUTE_TO_SERVICE_AGENT")
  })

  it("#9 price match is not sales T1", () => {
    assert.equal(confidentSkipMasterRoute("התאמת מחיר", emptyHistory), null)
  })

  it("rejects multi-question messages", () => {
    const body = "מתי מגיע המשלוח? וגם איזה סניפים יש?"
    assert.equal(looksLikeMultipleQuestions(body), true)
    assert.equal(confidentSkipMasterRoute(body, emptyHistory), null)
  })
})

describe("pickPrimaryQuestion", () => {
  it("prioritizes shipping over branch FAQ", () => {
    const questions = ["איזה סניפים יש?", "איפה המשלוח שלי?"]
    assert.equal(pickPrimaryQuestion(questions, emptyHistory), "איפה המשלוח שלי?")
  })

  it("prioritizes structured-flow yes/no when handoff pending", () => {
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

describe("multi-question detection", () => {
  it("detects council multi-Q example", () => {
    assert.equal(
      looksLikeMultipleQuestions("מתי מגיע המשלוח? וגם איזה סניפים יש?"),
      true
    )
  })
})
