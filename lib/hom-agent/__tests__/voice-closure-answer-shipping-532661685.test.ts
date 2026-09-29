import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldRecordVoiceClosureTemplate } from "@/lib/landbot/handle-inbound"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

// 532661685: after the voice-callback template the customer wrote "היי" + "לבדוק משלוח".
// The bot stayed silent (silent human_service) and a rep answered two hours later.
// Operator: the template only means the customer chose to wait for a rep on WhatsApp —
// the bot answers normally and hands off to service when a rep is still needed.
describe("voice callback template → bot answers shipping check (532661685)", () => {
  const history: HistoryMessage[] = [
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
    { role: "user", content: "היי" },
  ]

  it("records the dashboard template once so the LLM sees it", () => {
    assert.equal(shouldRecordVoiceClosureTemplate([]), true)
    assert.equal(
      shouldRecordVoiceClosureTemplate([{ role: "assistant", content: "*הום בוט :)* היי יעל" }]),
      true
    )
    assert.equal(
      shouldRecordVoiceClosureTemplate([{ role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY }]),
      false
    )
  })

  it("hints the LLM to answer the request and hand off to service only when needed", () => {
    const hints = buildConversationHints({ history, body: "היי\nלבדוק משלוח" }) ?? ""
    assert.match(hints, /VOICE CALLBACK TEMPLATE \(532661685\)/)
    assert.match(hints, /lookup_order_status/)
    assert.match(hints, /Never stay silent/)
    assert.match(hints, /human_service/)
  })

  it("does not add the hint once the bot already replied after the template", () => {
    const hints =
      buildConversationHints({
        history: [
          ...history,
          { role: "assistant", content: "*הום בוט :)* היי, איך אפשר לעזור?" },
        ],
        body: "לבדוק משלוח",
      }) ?? ""
    assert.ok(!/VOICE CALLBACK TEMPLATE/.test(hints))
  })
})
