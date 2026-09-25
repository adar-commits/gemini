import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import {
  qaRunConversationUrl,
  qaRunProblem,
  qaRunSolution,
} from "@/lib/agents/qa-run-summary"

function baseRun(
  overrides: Partial<QaAutomationRunRow> = {}
): QaAutomationRunRow {
  return {
    id: "1",
    session_id: "424358153",
    landbot_customer_id: null,
    conversation_url: "https://service.hom-group.co.il/conversations/424358153",
    trigger: "human_assign",
    phase: "analyze",
    outcome: "chained",
    verdict: "real_failure",
    confidence: "high",
    risk_score: 6,
    root_cause: null,
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
    created_at: "2026-09-24T20:13:00.000Z",
    updated_at: "2026-09-24T20:13:00.000Z",
    ...overrides,
  }
}

describe("qaRunConversationUrl", () => {
  it("uses service.hom-group URL from session when missing", () => {
    assert.equal(
      qaRunConversationUrl(
        baseRun({ conversation_url: "", session_id: "424358153" })
      ),
      "https://service.hom-group.co.il/conversations/424358153"
    )
  })
})

describe("qaRunProblem", () => {
  it("translates known English return/sales misroute summary to Hebrew", () => {
    const run = baseRun({
      root_cause:
        "The customer chose a return, then said yes to a service rep because the returns-portal code never arrived. Pre-turn treated that yes as a handoff confirm, but the department helper scanned the whole thread, saw the earlier exchange option that mentions a sales advisor, and assigned sales with the sales after-hours notice.",
    })
    const problem = qaRunProblem(run)
    assert.match(problem, /החזרה/)
    assert.match(problem, /מכירות/)
    assert.doesNotMatch(problem, /^The customer/)
  })

  it("keeps Hebrew root cause as-is", () => {
    const run = baseRun({
      root_cause: "הבוט העביר למכירות במקום לשירות.",
    })
    assert.equal(qaRunProblem(run), "הבוט העביר למכירות במקום לשירות.")
  })
})

describe("qaRunSolution", () => {
  it("prefers fix_plan over generic webhook operator note", () => {
    const run = baseRun({
      outcome: "chained",
      fix_plan: ["לקשור מחלקת העברה להקשר החזרה הפעיל, לא לסריקת מכירות"],
      operator_notes: "Implement webhook accepted — Composer run started.",
    })
    assert.equal(
      qaRunSolution(run),
      "לקשור מחלקת העברה להקשר החזרה הפעיל, לא לסריקת מכירות"
    )
  })

  it("localizes chained status when there is no fix plan", () => {
    const run = baseRun({
      outcome: "chained",
      operator_notes: "Implement webhook accepted — Composer run started.",
    })
    assert.equal(
      qaRunSolution(run),
      "הניתוח אישר תיקון — האוטומציה מיישמת עכשיו."
    )
  })

  it("localizes webhook_failed 401 implement chain notes to Hebrew", () => {
    const run = baseRun({
      outcome: "webhook_failed",
      operator_notes:
        "Implement approved but not started. Inbound webhook had no Authorization header, and this run has no CURSOR_AUTOMATION_QA_IMPLEMENT_TOKEN, so the production chain POST returned 401.",
    })
    const solution = qaRunSolution(run)
    assert.match(solution, /401|Authorization/)
    assert.match(solution, /↻/)
    assert.doesNotMatch(solution, /Implement approved/)
  })
})

describe("qaRunProblem order confirm", () => {
  it("translates order card + sizes English summary to Hebrew", () => {
    const run = baseRun({
      root_cause:
        "The customer confirmed the order card the bot had already shown, and also asked whether it comes in other sizes. The bot answered with the didn't-understand fallback and offered a service rep.",
    })
    const problem = qaRunProblem(run)
    assert.match(problem, /כרטיס/)
    assert.match(problem, /מידות/)
    assert.doesNotMatch(problem, /^The customer/)
  })
})
