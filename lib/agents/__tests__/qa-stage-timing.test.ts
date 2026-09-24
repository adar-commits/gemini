import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import {
  buildQaStageTimeline,
  formatStageDuration,
  resolveQaStageTimestamps,
} from "@/lib/agents/qa-stage-timing"

function row(
  overrides: Partial<QaAutomationRunRow> = {}
): QaAutomationRunRow {
  return {
    id: "1",
    session_id: "532360395",
    landbot_customer_id: null,
    conversation_url: "https://service.hom-group.co.il/conversations/532360395",
    trigger: "human_assign",
    phase: "implement",
    outcome: "implemented",
    verdict: "real_failure",
    confidence: "high",
    risk_score: 5,
    root_cause: "test",
    fix_layer: "hints",
    fix_plan: [],
    operator_questions: [],
    commit_sha: "e49fc80",
    changed_files: [],
    idempotency_key: null,
    operator_notes: null,
    stage_timestamps: {},
    created_at: "2026-09-24T20:58:30.000Z",
    updated_at: "2026-09-24T21:04:50.000Z",
    ...overrides,
  }
}

describe("resolveQaStageTimestamps", () => {
  it("merges sibling retry rows into one timeline", () => {
    const first = row({
      id: "a",
      outcome: "webhook_failed",
      created_at: "2026-09-24T20:26:23.000Z",
      updated_at: "2026-09-24T20:26:23.000Z",
    })
    const second = row({
      id: "b",
      outcome: "implemented",
      created_at: "2026-09-24T20:58:30.000Z",
      updated_at: "2026-09-24T21:04:50.000Z",
      stage_timestamps: {
        chain_at: "2026-09-24T20:58:30.000Z",
        implement_started_at: "2026-09-24T20:58:30.000Z",
        implement_completed_at: "2026-09-24T21:04:50.000Z",
      },
    })

    const ts = resolveQaStageTimestamps(second, [first])
    assert.equal(ts.event_at, "2026-09-24T20:26:23.000Z")
    assert.equal(ts.implement_completed_at, "2026-09-24T21:04:50.000Z")
  })
})

describe("buildQaStageTimeline", () => {
  it("returns four stage segments with durations", () => {
    const timeline = buildQaStageTimeline(
      row({
        stage_timestamps: {
          event_at: "2026-09-24T20:26:23.000Z",
          analyze_started_at: "2026-09-24T20:26:23.000Z",
          analyze_completed_at: "2026-09-24T20:58:30.000Z",
          chain_at: "2026-09-24T20:58:30.000Z",
          implement_started_at: "2026-09-24T20:58:30.000Z",
          implement_completed_at: "2026-09-24T21:04:50.000Z",
        },
      })
    )

    assert.equal(timeline.length, 4)
    assert.equal(timeline[1].id, "analyze")
    assert.ok((timeline[1].durationMs ?? 0) > 30 * 60 * 1000)
    assert.equal(timeline[3].status, "done")
  })
})

describe("formatStageDuration", () => {
  it("formats short durations in Hebrew", () => {
    assert.equal(formatStageDuration(45_000), "פחות מדקה")
    assert.equal(formatStageDuration(6 * 60 * 1000), "6 דק׳")
  })
})
