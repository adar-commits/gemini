import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  diagnoseWebhookFailure,
  isCursorResourceExhausted,
  webhookAutoRetryCount,
  webhookAutoRetryDelayMs,
} from "@/lib/landbot/qa-webhook-auto-retry"

describe("qa-webhook-auto-retry", () => {
  it("diagnoses 401 auth failures", () => {
    const text = diagnoseWebhookFailure(
      "Retry failed: HTTP 401 — Unauthorized",
      null
    )
    assert.match(text, /401/)
    assert.match(text, /WEBHOOK_TOKEN/)
  })

  it("diagnoses automation timeout", () => {
    const text = diagnoseWebhookFailure(
      "האוטומציה לא השיבה תוך 15 דקות",
      null
    )
    assert.match(text, /לא השיבה/)
  })

  it("detects Cursor resource_exhausted and uses longer backoff", () => {
    const notes =
      'HTTP 400: {"success":false,"error":"Failed to start background composer: [resource_exhausted] Error"}'
    assert.equal(isCursorResourceExhausted(notes, null), true)
    assert.match(diagnoseWebhookFailure(notes, null), /resource_exhausted|עומס/)
    assert.equal(webhookAutoRetryDelayMs(notes, null, 1), 90_000)
  })

  it("counts auto-retry markers in operator notes", () => {
    assert.equal(
      webhookAutoRetryCount("[auto-retry 1] failed\n[auto-retry 2] ok"),
      2
    )
    assert.equal(webhookAutoRetryCount(null), 0)
  })
})
