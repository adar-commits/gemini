import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { resolveQaRunRetryTarget } from "@/lib/landbot/qa-run-retry"

function baseRun(overrides: Partial<QaAutomationRunRow>): QaAutomationRunRow {
  return {
    id: "1",
    session_id: "530876768",
    landbot_customer_id: null,
    conversation_url: "https://service.hom-group.co.il/conversations/530876768",
    trigger: "human_assign",
    phase: "analyze",
    outcome: "triggered",
    verdict: null,
    confidence: null,
    risk_score: null,
    root_cause: null,
    fix_layer: null,
    fix_plan: [],
    operator_questions: [],
    commit_sha: null,
    changed_files: [],
    idempotency_key: "530876768:human_assign",
    operator_notes: null,
    stage_timestamps: {},
    created_at: "2026-09-24T17:25:00.000Z",
    updated_at: "2026-09-24T17:25:00.000Z",
    ...overrides,
  }
}

describe("resolveQaRunRetryTarget", () => {
  it("retries analyze for triggered webhook", () => {
    assert.equal(resolveQaRunRetryTarget(baseRun({ outcome: "triggered" })), "analyze")
  })

  it("retries implement when analyze approved a fix", () => {
    assert.equal(
      resolveQaRunRetryTarget(
        baseRun({
          outcome: "real_failure",
          verdict: "real_failure",
          confidence: "high",
          root_cause: "Wrong handoff department",
          fix_layer: "hints",
          fix_plan: ["Add exchange hint"],
        })
      ),
      "implement"
    )
  })

  it("does not retry implemented runs", () => {
    assert.equal(
      resolveQaRunRetryTarget(baseRun({ outcome: "implemented", phase: "implement" })),
      null
    )
  })
})
