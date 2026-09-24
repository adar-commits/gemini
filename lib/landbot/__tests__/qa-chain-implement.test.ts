import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  chainQaImplement,
  parseChainQaImplementBody,
} from "@/lib/landbot/qa-chain-implement"

describe("parseChainQaImplementBody", () => {
  it("parses analysis-only payload", () => {
    const parsed = parseChainQaImplementBody({
      analysis: {
        session_id: "532452401",
        conversation_url: "https://service.hom-group.co.il/conversations/532452401",
        trigger: "bot_failure",
        verdict: "real_failure",
        confidence: "high",
        root_cause: "Never-stuck with receipt in thread",
        fix_layer: "hints",
        fix_plan: ["Add hint"],
      },
    })
    assert.ok(parsed)
    assert.equal(parsed.analysis.session_id, "532452401")
    assert.equal(parsed.source, null)
  })

  it("rejects invalid analysis", () => {
    assert.equal(parseChainQaImplementBody({ analysis: { foo: 1 } }), null)
  })
})

describe("chainQaImplement", () => {
  it("skips when verdict is false_alarm", async () => {
    const result = await chainQaImplement({
      analysis: {
        session_id: "1",
        conversation_url: "https://service.hom-group.co.il/conversations/1",
        trigger: "human_assign",
        verdict: "false_alarm",
        confidence: "high",
        root_cause: "Customer wanted rep",
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.chained, false)
  })
})
