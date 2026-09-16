import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHomBotPrompt, homBotDepartmentPlaybookBytes } from "@/lib/hom-agent/hom-bot-prompt"

describe("hom-bot playbook split (plan I)", () => {
  it("omits department playbook on simple greeting", () => {
    const prompt = buildHomBotPrompt({
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
    })
    assert.doesNotMatch(prompt, /Department boundaries \(owner-locked\)/)
    assert.match(prompt, /Must-not-match examples/)
    assert.match(prompt, /Voice & identity/)
  })

  it("includes department playbook during service intake thread", () => {
    const prompt = buildHomBotPrompt({
      userText: "כן נכון",
      history: [
        { role: "user", content: "השטיח הגיע עם כתם" },
        {
          role: "assistant",
          content: "*הום בוט :)*\n… SO123 … נכון?",
        },
      ],
    })
    assert.match(prompt, /Department boundaries \(owner-locked\)/)
    assert.ok(homBotDepartmentPlaybookBytes() > 5000)
  })
})
