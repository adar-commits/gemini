import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldRecordVoiceClosureTemplate } from "@/lib/landbot/handle-inbound"
import { VOICE_CLOSURE_TEMPLATE_BODY } from "@/lib/landbot/voice-closure-template"
import type { HistoryMessage } from "@/lib/agents/types"

function history534266493BeforeComplaint(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)* היי יובל! 😊 במה אפשר לעזור?",
    },
    { role: "assistant", content: VOICE_CLOSURE_TEMPLATE_BODY },
  ]
}

/** 534266493 — cancel/delivery complaint must not re-inject voice_closure_template after bot already replied. */
describe("voice closure not repeated after bot reply 534266493", () => {
  it("does not record voice template again once it is already in history", () => {
    assert.equal(shouldRecordVoiceClosureTemplate([]), true)
    assert.equal(
      shouldRecordVoiceClosureTemplate([{ role: "assistant", content: "*הום בוט :)* היי יובל" }]),
      true
    )
    assert.equal(
      shouldRecordVoiceClosureTemplate(history534266493BeforeComplaint()),
      false
    )
  })
})
