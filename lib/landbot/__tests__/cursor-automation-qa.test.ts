import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import {
  buildBotFailureIdempotencyKey,
  buildHandoffIdempotencyKey,
  buildManualQaIdempotencyKey,
  buildCursorAutomationQaPayload,
  buildCursorAutomationWebhookHeaders,
  buildHomServiceConversationUrl,
  cursorAutomationQaAuthToken,
  cursorAutomationQaEnabled,
  cursorAutomationQaTriggers,
  phoneLastFour,
  shouldNotifyCursorAutomationQa,
} from "@/lib/landbot/cursor-automation-qa"

describe("cursor automation qa webhook", () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.CURSOR_AUTOMATION_QA_WEBHOOK_URL =
      "https://api2.cursor.sh/automations/webhook/test-id"
    process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN = "crsr_test_token"
    process.env.CURSOR_AUTOMATION_QA_ENABLED = "1"
    process.env.CURSOR_AUTOMATION_QA_TRIGGERS = "human_assign"
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it("builds the service portal conversation url", () => {
    assert.equal(
      buildHomServiceConversationUrl("508272038"),
      "https://service.hom-group.co.il/conversations/508272038"
    )
  })

  it("defaults to human_assign and bot_failure", () => {
    delete process.env.CURSOR_AUTOMATION_QA_TRIGGERS
    assert.deepEqual([...cursorAutomationQaTriggers()], [
      "human_assign",
      "bot_failure",
    ])
    assert.equal(shouldNotifyCursorAutomationQa("human_assign"), true)
    assert.equal(shouldNotifyCursorAutomationQa("bot_failure"), true)
    assert.equal(shouldNotifyCursorAutomationQa("reset"), false)
  })

  it("builds webhook payload with idempotency key and event window", () => {
    const payload = buildCursorAutomationQaPayload({
      sessionId: "508272038",
      landbotCustomerId: "508054404",
      trigger: "human_assign",
      handoffAction: "human_service",
      lastUserMessage: "כן תודה",
      lastBotReply: "מעולה, העברתי את השיחה לנציג שירות",
      phone: "+972525368636",
      eventWindowSince: "2026-09-24T20:17:50.000Z",
      eventWindowReason: "trainer_reset",
      eventWindowMessageCount: 24,
      totalMessageCount: 2197,
    })
    assert.equal(payload.session_id, "508272038")
    assert.equal(payload.landbot_customer_id, "508054404")
    assert.equal(payload.trigger, "human_assign")
    assert.equal(payload.handoff_action, "human_service")
    assert.equal(payload.idempotency_key, "508272038:human_assign")
    assert.equal(payload.phone_last4, "8636")
    assert.equal(payload.event_window_since, "2026-09-24T20:17:50.000Z")
    assert.equal(payload.event_window_reason, "trainer_reset")
    assert.equal(payload.event_window_message_count, 24)
    assert.equal(payload.total_message_count, 2197)
    assert.match(payload.conversation_url, /508272038/)
  })

  it("adds a per-event callback token when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "cron-test-secret"
    const base = {
      sessionId: "508272038",
      trigger: "manual" as const,
      eventWindowSince: "2026-09-24T20:17:50.000Z",
      eventWindowReason: "opened_at" as const,
      eventWindowMessageCount: 5,
      totalMessageCount: 5,
    }
    const a = buildCursorAutomationQaPayload({ ...base, idempotencyKey: "manual:508272038:1" })
    const b = buildCursorAutomationQaPayload({ ...base, idempotencyKey: "manual:508272038:2" })
    assert.match(a.callback_token ?? "", /^[0-9a-f]{40}$/)
    assert.notEqual(a.callback_token, b.callback_token)
  })

  it("is enabled with webhook url and token", () => {
    assert.equal(cursorAutomationQaEnabled(), true)
    assert.equal(shouldNotifyCursorAutomationQa("human_assign"), true)
  })

  it("is disabled without webhook url", () => {
    delete process.env.CURSOR_AUTOMATION_QA_WEBHOOK_URL
    assert.equal(cursorAutomationQaEnabled(), false)
    assert.equal(shouldNotifyCursorAutomationQa("human_assign"), false)
  })

  it("is disabled without webhook token (Cursor would 401)", () => {
    delete process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN
    assert.equal(cursorAutomationQaEnabled(), false)
  })

  it("is disabled by CURSOR_AUTOMATION_QA_ENABLED=0", () => {
    process.env.CURSOR_AUTOMATION_QA_ENABLED = "0"
    assert.equal(cursorAutomationQaEnabled(), false)
  })

  it("masks phone to last four digits", () => {
    assert.equal(phoneLastFour("0525368636"), "8636")
    assert.equal(phoneLastFour(null), null)
  })

  it("builds Authorization header from webhook token env", () => {
    process.env.CURSOR_AUTOMATION_QA_WEBHOOK_TOKEN = "Bearer crsr_test_token"
    assert.equal(cursorAutomationQaAuthToken(), "crsr_test_token")
    assert.equal(
      buildCursorAutomationWebhookHeaders(cursorAutomationQaAuthToken())
        .Authorization,
      "Bearer crsr_test_token"
    )
  })

  it("builds unique manual idempotency keys", () => {
    const a = buildManualQaIdempotencyKey("532360395", 1_000)
    const b = buildManualQaIdempotencyKey("532360395", 2_000)
    assert.match(a, /^manual:532360395:\d+$/)
    assert.notEqual(a, b)
  })

  it("builds per-turn bot_failure idempotency keys", () => {
    const at = Date.parse("2026-09-25T08:00:00.000Z")
    const a = buildBotFailureIdempotencyKey("508272038", "מתי יגיע המשלוח", at)
    const b = buildBotFailureIdempotencyKey("508272038", "מתי יגיע המשלוח", at + 60_000)
    const c = buildBotFailureIdempotencyKey("508272038", "אחרת", at)
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.match(a, /^508272038:bot_failure:\d+:\d+$/)
  })

  it("gives every handoff its own event, collapsing only a re-delivered turn", () => {
    const at = Date.parse("2026-09-25T08:00:00.000Z")
    const first = buildHandoffIdempotencyKey("508272038", "כן תודה", at)
    assert.equal(first, buildHandoffIdempotencyKey("508272038", "כן תודה", at + 60_000))
    assert.notEqual(first, buildHandoffIdempotencyKey("508272038", "כן תודה", at + 3 * 3600_000))
    assert.notEqual(first, buildHandoffIdempotencyKey("508272038", "אשמח לנציג", at))
    assert.match(first, /^508272038:human_assign:\d+:\d+$/)
  })
})
