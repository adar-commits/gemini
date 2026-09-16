import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHomAgentSystemPrompt,
  homAgentFinalOutputIndex,
  homAgentKbSectionIndex,
} from "@/lib/hom-agent/prompt"

describe("prompt cache prefix order", () => {
  it("places static FINAL OUTPUT before dynamic KB section", () => {
    const prompt = buildHomAgentSystemPrompt({
      userText: "מתי מגיע המשלוח",
      history: [{ role: "user", content: "מתי מגיע המשלוח" }],
      whatsappPhone: "0501234567",
      sessionSummary: "לקוח שואל על משלוח",
    })

    const finalIdx = homAgentFinalOutputIndex(prompt)
    const kbIdx = homAgentKbSectionIndex(prompt)
    assert.ok(finalIdx >= 0, "FINAL OUTPUT block must exist")
    assert.ok(kbIdx >= 0, "KB section must exist")
    assert.ok(finalIdx < kbIdx, "static contract must precede per-turn KB for cache prefix")
  })

  it("keeps hom-bot playbook before FINAL OUTPUT", () => {
    const prompt = buildHomAgentSystemPrompt({ userText: "שלום" })
    assert.ok(prompt.includes("### FINAL OUTPUT"))
    assert.ok(homAgentFinalOutputIndex(prompt) > 1000, "hom-bot.md should lead the prompt")
  })
})
