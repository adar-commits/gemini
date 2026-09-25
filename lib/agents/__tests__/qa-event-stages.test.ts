import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { qaEventProgress } from "@/lib/agents/qa-event-stages"

const T0 = "2026-09-25T07:00:00.000Z"

function run(overrides: Partial<QaAutomationRunRow>): QaAutomationRunRow {
  return {
    id: "1",
    session_id: "346228669",
    landbot_customer_id: null,
    conversation_url: "https://service.hom-group.co.il/conversations/346228669",
    trigger: "manual",
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
    idempotency_key: "manual:346228669:1",
    operator_notes: null,
    operator_input: null,
    stage_timestamps: { event_at: T0 },
    created_at: T0,
    updated_at: T0,
    ...overrides,
  }
}

const states = (progress: ReturnType<typeof qaEventProgress>) =>
  progress.stages.map((stage) => stage.state)

describe("qaEventProgress", () => {
  const now = Date.parse("2026-09-25T07:05:00.000Z")

  it("has seven stages and waits for the automation right after send", () => {
    const progress = qaEventProgress(run({}), now)
    assert.equal(progress.stages.length, 7)
    assert.deepEqual(states(progress).slice(0, 3), ["done", "active", "pending"])
    assert.equal(progress.position, 2)
    assert.equal(progress.tone, "active")
    assert.match(progress.headline, /ממתין שהאוטומציה תתחיל/)
  })

  it("follows reported stages", () => {
    const progress = qaEventProgress(
      run({
        stage_timestamps: {
          event_at: T0,
          reading_started_at: "2026-09-25T07:01:00.000Z",
          analyze_started_at: "2026-09-25T07:02:00.000Z",
        },
      }),
      now
    )
    assert.deepEqual(states(progress).slice(0, 4), ["done", "done", "active", "pending"])
    assert.equal(progress.position, 3)
  })

  it("moves past the decision to coding when the gate passed", () => {
    const progress = qaEventProgress(
      run({
        outcome: "chained",
        stage_timestamps: { event_at: T0, analyze_completed_at: "2026-09-25T07:03:00.000Z" },
      }),
      now
    )
    assert.equal(progress.stages[3]!.state, "done")
    assert.equal(progress.stages[4]!.state, "active")
    assert.equal(progress.position, 5)
  })

  it("shows testing when reported", () => {
    const progress = qaEventProgress(
      run({
        outcome: "chained",
        stage_timestamps: { event_at: T0, testing_started_at: "2026-09-25T07:04:00.000Z" },
      }),
      now
    )
    assert.deepEqual(states(progress), ["done", "done", "done", "done", "done", "active", "pending"])
  })

  it("waits on the operator for ask_operator / too_risky", () => {
    const progress = qaEventProgress(run({ outcome: "ask_operator" }), now)
    assert.equal(progress.stages[3]!.state, "waiting")
    assert.equal(progress.tone, "waiting")
    assert.match(progress.headline, /ממתין לתשובה שלך/)
  })

  it("skips fix stages for a false alarm", () => {
    const progress = qaEventProgress(run({ outcome: "false_alarm" }), now)
    assert.deepEqual(states(progress).slice(4), ["skipped", "skipped", "skipped"])
    assert.equal(progress.tone, "closed")
  })

  it("marks the failing stage for failed_guard and webhook_failed", () => {
    const guard = qaEventProgress(run({ outcome: "failed_guard", phase: "implement" }), now)
    assert.equal(guard.stages[4]!.state, "failed")
    const webhook = qaEventProgress(run({ outcome: "webhook_failed" }), now)
    assert.equal(webhook.stages[0]!.state, "failed")
  })

  it("is complete when implemented, ignoring shipped stamps on older events", () => {
    assert.equal(qaEventProgress(run({ outcome: "implemented" }), now).percent, 100)
    const older = qaEventProgress(
      run({
        outcome: "webhook_failed",
        stage_timestamps: { event_at: T0, implement_completed_at: "2026-09-25T07:04:00.000Z" },
      }),
      now
    )
    assert.equal(older.stages[0]!.state, "failed")
  })

  it("flags stale in-progress events", () => {
    const later = Date.parse("2026-09-25T07:45:00.000Z")
    assert.equal(qaEventProgress(run({}), later).stale, true)
    assert.equal(qaEventProgress(run({ outcome: "false_alarm" }), later).stale, false)
  })
})
