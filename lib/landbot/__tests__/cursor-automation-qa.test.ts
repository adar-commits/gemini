import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import {
  buildBotFailureIdempotencyKey,
  buildCursorAutomationQaPayload,
  buildHomServiceConversationUrl,
  cursorAutomationQaEnabled,
  cursorAutomationQaTriggers,
  phoneLastFour,
  shouldNotifyCursorAutomationQa,
} from "@/lib/landbot/cursor-automation-qa"

describe("cursor automation qa webhook", () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.CURSOR_AUTOMATION_WEBHOOK_URL =
      "https://api2.cursor.sh/automations/webhook/test-id"
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

  it("builds webhook payload with idempotency key", () => {
    const payload = buildCursorAutomationQaPayload({
      sessionId: "508272038",
      landbotCustomerId: "508054404",
      trigger: "human_assign",
      handoffAction: "human_service",
      lastUserMessage: "כן תודה",
      lastBotReply: "מעולה, העברתי את השיחה לנציג שירות",
      phone: "+972525368636",
    })
    assert.equal(payload.session_id, "508272038")
    assert.equal(payload.landbot_customer_id, "508054404")
    assert.equal(payload.trigger, "human_assign")
    assert.equal(payload.handoff_action, "human_service")
    assert.equal(payload.idempotency_key, "508272038:human_assign")
    assert.equal(payload.phone_last4, "8636")
    assert.match(payload.conversation_url, /508272038/)
  })

  it("is disabled without webhook url", () => {
    delete process.env.CURSOR_AUTOMATION_WEBHOOK_URL
    assert.equal(cursorAutomationQaEnabled(), false)
    assert.equal(shouldNotifyCursorAutomationQa("human_assign"), false)
  })

  it("masks phone to last four digits", () => {
    assert.equal(phoneLastFour("0525368636"), "8636")
    assert.equal(phoneLastFour(null), null)
  })

  it("builds per-turn bot_failure idempotency keys", () => {
    const a = buildBotFailureIdempotencyKey("508272038", "מתי יגיע המשלוח")
    const b = buildBotFailureIdempotencyKey("508272038", "מתי יגיע המשלוח")
    const c = buildBotFailureIdempotencyKey("508272038", "אחרת")
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.match(a, /^508272038:bot_failure:\d+$/)
  })
})
