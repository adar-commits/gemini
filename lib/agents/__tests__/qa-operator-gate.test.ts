import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOperatorContinuationNotes,
  operatorQuestionsAnswered,
} from "@/lib/agents/qa-operator-gate"
import {
  isQaRunAwaitingAutomationContinue,
  isQaRunWaitingForOperator,
} from "@/lib/agents/qa-event-stages"

describe("qa operator gate", () => {
  it("detects when every MCQ was answered", () => {
    assert.equal(
      operatorQuestionsAnswered({
        operator_questions: ["שאלה 1", "שאלה 2"],
        operator_replies: [{ at: "t1", text: "a1" }],
      }),
      false
    )
    assert.equal(
      operatorQuestionsAnswered({
        operator_questions: ["שאלה 1", "שאלה 2"],
        operator_replies: [
          { at: "t1", text: "a1" },
          { at: "t2", text: "a2" },
        ],
      }),
      true
    )
  })

  it("stops showing the reply box after MCQs are answered", () => {
    const run = {
      outcome: "too_risky" as const,
      operator_questions: ["שאלה 1", "שאלה 2"],
      operator_replies: [
        { at: "t1", text: "a1" },
        { at: "t2", text: "a2" },
      ],
    }
    assert.equal(isQaRunWaitingForOperator(run), false)
    assert.equal(isQaRunAwaitingAutomationContinue(run), true)
  })

  it("builds implement continuation notes when gate passed", () => {
    const note = buildOperatorContinuationNotes(
      {
        operator_questions: ["q1"],
        operator_replies: [{ at: "t1", text: "a1" }],
        fix_layer: "runtime",
        fix_plan: ["merge image + text"],
        verdict: "too_risky",
      },
      "Operator replied — automation continuing."
    )
    assert.match(note, /OPERATOR GATE PASSED/)
    assert.match(note, /chained/)
    assert.match(note, /runtime/)
  })
})
