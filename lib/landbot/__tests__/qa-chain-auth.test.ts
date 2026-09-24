import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import { isQaChainAuthorized } from "@/lib/landbot/qa-chain-auth"

describe("isQaChainAuthorized", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  it("accepts analyze webhook token", () => {
    process.env.CURSOR_AUTOMATION_QA_ANALYZE_TOKEN = "test-analyze-token"
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer test-analyze-token" },
    })
    assert.equal(isQaChainAuthorized(request), true)
  })

  it("accepts cron secret", () => {
    process.env.CRON_SECRET = "cron-test"
    process.env.CURSOR_AUTOMATION_QA_ANALYZE_TOKEN = ""
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer cron-test" },
    })
    assert.equal(isQaChainAuthorized(request), true)
  })
})
