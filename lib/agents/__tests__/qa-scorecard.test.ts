import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { buildQaScorecard } from "@/lib/agents/qa-scorecard"

function baseRun(overrides: Partial<QaAutomationRunRow>): QaAutomationRunRow {
  return {
    id: "1",
    session_id: "532360395",
    landbot_customer_id: null,
    conversation_url: "https://service.hom-group.co.il/conversations/532360395",
    trigger: "manual",
    phase: "analyze",
    outcome: "real_failure",
    verdict: "real_failure",
    confidence: "high",
    risk_score: 7,
    root_cause: "test",
    fix_layer: "hints",
    fix_plan: [],
    operator_questions: [],
    commit_sha: null,
    changed_files: [],
    idempotency_key: null,
    operator_notes: null,
    operator_input: null,
    operator_replies: [],
    stage_timestamps: {},
    created_at: "2026-09-24T20:00:00.000Z",
    updated_at: "2026-09-24T20:00:00.000Z",
    ...overrides,
  }
}

describe("qa scorecard", () => {
  it("derives llm dominancy from fix layer", () => {
    const card = buildQaScorecard(baseRun({ fix_layer: "hints" }))
    assert.equal(card.llmDominancy, 8)
    assert.match(card.mainFault, /רמזי תור/)
  })

  it("falls back to risk score when fix layer missing", () => {
    const card = buildQaScorecard(baseRun({ fix_layer: null, risk_score: 6 }))
    assert.equal(card.llmDominancy, 6)
  })
})
