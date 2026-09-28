import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  coerceQaAnalyzeOutcome,
  isLameOperatorQuestion,
  qaImplementGatePasses,
  shouldWaitForOperator,
} from "@/lib/agents/qa-autonomy-gate"

const clearFix = {
  fixLayer: "hints",
  fixPlan: ["הוסף hint ל-order confirm"],
  confidence: "high",
  riskScore: 4,
}

describe("qa-autonomy-gate", () => {
  it("passes implement gate for clear hints fix", () => {
    assert.equal(qaImplementGatePasses(clearFix), true)
  })

  it("does not wait when ask_operator only has lame confirmation MCQs", () => {
    assert.equal(
      shouldWaitForOperator({
        outcome: "ask_operator",
        operatorQuestions: ["האם לאשר את התיקון?"],
        ...clearFix,
      }),
      false
    )
    assert.equal(isLameOperatorQuestion("האם לאשר את התיקון?"), true)
  })

  it("waits for critical Hebrew policy questions", () => {
    assert.equal(
      shouldWaitForOperator({
        outcome: "ask_operator",
        operatorQuestions: ["בשישי שירות הלקוחות סגור או פתוח חלקית?"],
        fixLayer: "prompt",
        fixPlan: ["עדכן שעות"],
        confidence: "medium",
        riskScore: 3,
      }),
      true
    )
  })

  it("coerces ask_operator with obvious fix to chained", () => {
    const coerced = coerceQaAnalyzeOutcome({
      outcome: "ask_operator",
      operatorQuestions: ["להמשיך לתיקון?"],
      ...clearFix,
    })
    assert.equal(coerced.outcome, "chained")
    assert.equal(coerced.autoContinue, true)
    assert.deepEqual(coerced.operatorQuestions, [])
  })

  it("keeps critical policy ask_operator unchanged", () => {
    const coerced = coerceQaAnalyzeOutcome({
      outcome: "ask_operator",
      operatorQuestions: ["האם מדיניות ההחזר כוללת משלוח?"],
      fixLayer: null,
      fixPlan: [],
      confidence: "low",
      riskScore: 5,
    })
    assert.equal(coerced.outcome, "ask_operator")
    assert.equal(coerced.autoContinue, false)
  })
})
