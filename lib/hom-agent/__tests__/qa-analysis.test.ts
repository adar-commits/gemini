import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildImplementWebhookPayload,
  parseQaAnalysis,
  shouldChainQaImplement,
} from "@/lib/hom-agent/qa-analysis"

describe("qa-analysis", () => {
  it("approves implement chain only for high-confidence real failures", () => {
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
    assert.equal(shouldChainQaImplement(ok!), true)

    const low = { ...ok!, confidence: "medium" as const }
    assert.equal(shouldChainQaImplement(low), false)

    const alarm = { ...ok!, verdict: "false_alarm" as const }
    assert.equal(shouldChainQaImplement(alarm), false)
  })

  it("builds implement payload with implement idempotency key", () => {
    const analysis = parseQaAnalysis({
      session_id: "532452401",
      conversation_url: "https://service.hom-group.co.il/conversations/532452401",
      trigger: "bot_failure",
      verdict: "real_failure",
      confidence: "high",
      root_cause: "Never stuck",
      fix_layer: "prompt",
      fix_plan: ["Bind receipt order confirm"],
    })!
    const payload = buildImplementWebhookPayload({
      source: {
        conversation_url: analysis.conversation_url,
        session_id: analysis.session_id,
        landbot_customer_id: null,
        trigger: "bot_failure",
        idempotency_key: "532452401:bot_failure:1",
        sent_at: "2026-09-24T00:00:00.000Z",
      },
      analysis,
    })
    assert.equal(payload.phase, "implement")
    assert.match(payload.idempotency_key, /^532452401:implement:\d+$/)
  })
})
