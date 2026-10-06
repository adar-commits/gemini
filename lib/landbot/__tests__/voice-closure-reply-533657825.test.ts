import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import { shouldRecordVoiceClosureTemplate } from "@/lib/landbot/handle-inbound"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

// 533657825: customer replied after the phone-callback closure template while CRM still
// showed Avigail assigned — gemini must wake HoM bot instead of staying silent.
describe("voice closure customer reply wake (533657825)", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: "היי שלום" },
  ]

  it("records the phone-callback template once for LLM context", () => {
    assert.equal(shouldRecordVoiceClosureTemplate([]), true)
    assert.equal(
      shouldRecordVoiceClosureTemplate([
        { role: "assistant", content: PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY },
      ]),
      false
    )
  })

  it("hints the LLM to answer normally after the phone-callback template", () => {
    const hints = buildConversationHints({ history, body: "היי שלום" }) ?? ""
    assert.match(hints, /VOICE CALLBACK TEMPLATE \(532661685 \/ 533657825\)/)
    assert.match(hints, /שיחתך הטלפונית/)
    assert.match(hints, /Never stay silent/)
  })
})
