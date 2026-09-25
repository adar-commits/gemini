import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseQaAnalysis, shouldImplementQaFix } from "@/lib/hom-agent/qa-analysis"

describe("qa-analysis", () => {
  it("approves implement only for high-confidence real failures", () => {
    const ok = parseQaAnalysis({
      session_id: "532452401",
      conversation_url: "https://service.hom-group.co.il/conversations/532452401",
      trigger: "bot_failure",
      verdict: "real_failure",
      confidence: "high",
      root_cause: "Empty reply on known receipt order",
      fix_layer: "hints",
      fix_plan: ["Add KNOWN ORDER hint when receipt orderID in thread"],
    })
    assert.ok(ok)
    assert.equal(shouldImplementQaFix(ok!), true)

    const low = { ...ok!, confidence: "medium" as const }
    assert.equal(shouldImplementQaFix(low), false)

    const alarm = { ...ok!, verdict: "false_alarm" as const }
    assert.equal(shouldImplementQaFix(alarm), false)

    const noPlan = { ...ok!, fix_plan: [] }
    assert.equal(shouldImplementQaFix(noPlan), false)
  })

  it("rejects analysis without root cause", () => {
    assert.equal(
      parseQaAnalysis({
        session_id: "532452401",
        conversation_url: "https://service.hom-group.co.il/conversations/532452401",
        trigger: "human_assign",
        verdict: "false_alarm",
        confidence: "high",
        root_cause: "",
      }),
      null
    )
  })
})
