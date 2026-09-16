import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractTokenCounts } from "@/lib/agent-core/token-usage"

describe("extractTokenCounts cache fields", () => {
  it("reads cacheReadTokens and cacheWriteTokens from inputTokenDetails", () => {
    const counts = extractTokenCounts({
      inputTokens: 50_000,
      outputTokens: 400,
      inputTokenDetails: {
        cacheReadTokens: 45_000,
        cacheWriteTokens: 5_000,
      },
    })
    assert.equal(counts.inputTokens, 50_000)
    assert.equal(counts.outputTokens, 400)
    assert.equal(counts.cacheReadTokens, 45_000)
    assert.equal(counts.cacheWriteTokens, 5_000)
  })

  it("defaults cache fields to zero when missing", () => {
    const counts = extractTokenCounts({ promptTokens: 100, completionTokens: 20 })
    assert.equal(counts.cacheReadTokens, 0)
    assert.equal(counts.cacheWriteTokens, 0)
  })
})
