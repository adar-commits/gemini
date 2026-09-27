import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildVoiceClosureSilentHandoffResult } from "@/lib/landbot/handle-inbound"
import {
  VOICE_CLOSURE_TEMPLATE_BODY,
  VOICE_CLOSURE_TEMPLATE_ID,
  isVoiceClosureTemplateMessage,
} from "@/lib/landbot/voice-closure-template"

// 532595811: the dashboard sent the voice-closure template ("כאן נציג/ה ... בהמשך לבקשתך"),
// the customer replied about a missing carpet + invoice, and the bot answered with a
// "זה מדויק, או שחסר משהו?" summary instead of staying silent for the rep.
describe("voice closure template → silent human_service (532595811)", () => {
  it("detects the template by landbot template id", () => {
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "template",
        body: "any rendered body",
        payload: { template: { id: VOICE_CLOSURE_TEMPLATE_ID } },
      }),
      true
    )
  })

  it("detects the template by its rendered body when payload is missing", () => {
    assert.equal(
      isVoiceClosureTemplateMessage({ message_type: "text", body: ` ${VOICE_CLOSURE_TEMPLATE_BODY}\n` }),
      true
    )
  })

  it("does not treat a bot reply or another template as the voice closure", () => {
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "text",
        body: "*הום בוט :)* בוקר טוב נתי, מצטער שהגיע רק שטיח אחד מתוך השניים. זה מדויק, או שחסר משהו?",
      }),
      false
    )
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "template",
        body: "ראיתי שלא השלמת את הרכישה",
        payload: { template: { id: "111" } },
      }),
      false
    )
    assert.equal(isVoiceClosureTemplateMessage(null), false)
  })

  it("hands off to human service with no bot reply", () => {
    const result = buildVoiceClosureSilentHandoffResult("reply")
    assert.equal(result.action, "human_service")
    assert.equal(result.reply, "")
    assert.equal(result.skipped, "voice_closure_template")
    assert.ok(!/זה מדויק/.test(result.reply ?? ""))
  })
})
