import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSuppressOutboundForHumanThread } from "@/lib/landbot/handle-inbound"
import { PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "דיברנו אתמול יא בוט כושל\nמה עם ההזמנות שלי?\nאני רגע לפני פנייה לעורכי דין"

/** 534274729 — voice-closure wake must not suppress the real LLM reply at send time. */
describe("voice closure wake send gate 534274729", () => {
  it("does not suppress outbound when voiceClosureWake reclaimed the thread", () => {
    assert.equal(
      shouldSuppressOutboundForHumanThread({
        voiceClosureWake: true,
        trainerResetBypass: false,
        humanThreadActive: true,
        bypassHumanThreadSilence: false,
      }),
      false
    )
    assert.equal(
      shouldSuppressOutboundForHumanThread({
        voiceClosureWake: false,
        trainerResetBypass: false,
        humanThreadActive: true,
        bypassHumanThreadSilence: false,
      }),
      true
    )
  })

  it("hints shipping lookup after phone-callback template on angry order ask", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: PHONE_CALLBACK_CLOSURE_TEMPLATE_BODY },
    ]
    const hints = buildConversationHints({ history, body: OPENING }) ?? ""
    assert.match(hints, /VOICE CALLBACK TEMPLATE/)
    assert.match(hints, /lookup_order_status/)
  })
})
