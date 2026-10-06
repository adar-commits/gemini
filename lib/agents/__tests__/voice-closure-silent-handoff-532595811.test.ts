import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY,
  PHONE_CALLBACK_CLOSURE_TEMPLATE_ID,
  VOICE_CLOSURE_TEMPLATE_BODY,
  VOICE_CLOSURE_TEMPLATE_ID,
  isVoiceClosureTemplateMessage,
  voiceClosureTemplateBodyFromRow,
} from "@/lib/landbot/voice-closure-template"

// 532595811: the dashboard sent the voice-closure template ("כאן נציג/ה ... בהמשך לבקשתך"),
// the customer replied about a missing carpet + invoice, and the bot answered with a
// "זה מדויק, או שחסר משהו?" summary instead of staying silent for the rep.
describe("voice closure template detection (532595811)", () => {
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

  it("detects the phone-callback closure template by hub id (533657825)", () => {
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "template",
        body: null,
        payload: { template: { id: PHONE_CALLBACK_CLOSURE_TEMPLATE_ID } },
      }),
      true
    )
    assert.equal(
      voiceClosureTemplateBodyFromRow({
        message_type: "template",
        body: null,
        payload: { template: { id: PHONE_CALLBACK_CLOSURE_TEMPLATE_ID } },
      }),
      PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY
    )
  })

  it("detects the phone-callback closure template by rendered body", () => {
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "text",
        body: ` ${PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY}\n`,
      }),
      true
    )
    assert.equal(
      isVoiceClosureTemplateMessage({
        message_type: "text",
        body: "היי 😀👋, מחלקת שירות הלקוחות שלנו פועלת ב-WhatsApp / אימייל בלבד. פונה אלייך בהמשך לשיחתך הטלפונית, איך אוכל לעזור?",
      }),
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
})
