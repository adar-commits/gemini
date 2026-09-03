import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isGatewayBudgetExceeded } from "@/lib/agent-core/gateway-errors"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"

describe("gateway budget errors", () => {
  it("detects Vercel AI Gateway budget exceeded", () => {
    const error = new Error(
      "Team budget exceeded. Current spend: $20.05, limit: $20.00."
    )
    assert.equal(isGatewayBudgetExceeded(error), true)
  })

  it("buildLlmFailureReply mentions capacity when budget exceeded", () => {
    const reply = buildLlmFailureReply({ gatewayBudgetExceeded: true })
    assert.match(reply, /מלאה כרגע/)
  })
})
