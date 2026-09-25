import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import { isQaCallbackAuthorized, qaCallbackToken } from "@/lib/agents/qa-callback-token"

function request(token: string) {
  return new Request("https://example.test/api/agents/qa-runs", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  })
}

describe("qa callback token", () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret"
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it("is stable per event and differs between events", () => {
    const a = qaCallbackToken("manual:346228669:1")
    assert.ok(a)
    assert.equal(a, qaCallbackToken("manual:346228669:1"))
    assert.notEqual(a, qaCallbackToken("manual:346228669:2"))
  })

  it("authorizes only its own event", () => {
    const token = qaCallbackToken("manual:346228669:1")!
    assert.equal(isQaCallbackAuthorized(request(token), "manual:346228669:1"), true)
    assert.equal(isQaCallbackAuthorized(request(token), "manual:346228669:2"), false)
    assert.equal(isQaCallbackAuthorized(request(token), null), false)
  })

  it("still accepts CRON_SECRET for operator scripts", () => {
    assert.equal(isQaCallbackAuthorized(request("cron-test-secret"), null), true)
  })

  it("issues no token without CRON_SECRET", () => {
    delete process.env.CRON_SECRET
    assert.equal(qaCallbackToken("manual:346228669:1"), null)
  })
})
