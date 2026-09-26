import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isQaRunPastActiveTimeout,
  QA_RUN_ANALYZE_TIMEOUT_MS,
  QA_RUN_IMPLEMENT_TIMEOUT_MS,
  qaRunActiveTimeoutMs,
} from "@/lib/agents/qa-run-expiry"

const T0 = "2026-09-25T14:00:00.000Z"

describe("qa run expiry", () => {
  it("uses shorter timeout for triggered analyze runs", () => {
    assert.equal(qaRunActiveTimeoutMs({ outcome: "triggered", phase: "analyze" }), QA_RUN_ANALYZE_TIMEOUT_MS)
    assert.equal(qaRunActiveTimeoutMs({ outcome: "chained", phase: "implement" }), QA_RUN_IMPLEMENT_TIMEOUT_MS)
    assert.equal(qaRunActiveTimeoutMs({ outcome: "false_alarm", phase: "analyze" }), null)
  })

  it("flags triggered runs past analyze ceiling", () => {
    const run = {
      outcome: "triggered" as const,
      phase: "analyze" as const,
      created_at: T0,
      updated_at: T0,
    }
    const inside = Date.parse(T0) + QA_RUN_ANALYZE_TIMEOUT_MS - 60_000
    const outside = Date.parse(T0) + QA_RUN_ANALYZE_TIMEOUT_MS + 60_000
    assert.equal(isQaRunPastActiveTimeout(run, inside), false)
    assert.equal(isQaRunPastActiveTimeout(run, outside), true)
  })

  it("flags chained implement runs past longer ceiling", () => {
    const run = {
      outcome: "chained" as const,
      phase: "implement" as const,
      created_at: T0,
      updated_at: T0,
    }
    const inside = Date.parse(T0) + QA_RUN_IMPLEMENT_TIMEOUT_MS - 60_000
    const outside = Date.parse(T0) + QA_RUN_IMPLEMENT_TIMEOUT_MS + 60_000
    assert.equal(isQaRunPastActiveTimeout(run, inside), false)
    assert.equal(isQaRunPastActiveTimeout(run, outside), true)
  })
})
