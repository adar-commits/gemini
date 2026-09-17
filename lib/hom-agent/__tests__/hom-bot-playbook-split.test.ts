import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHomBotPrompt,
  homBotDepartmentPlaybookBytes,
  homBotReferenceSectionBytes,
} from "@/lib/hom-agent/hom-bot-prompt"

describe("hom-bot playbook split (plan I/J + LLM-first)", () => {
  it("omits department playbook on structured-bound greeting", () => {
    const prompt = buildHomBotPrompt({
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
      llmOwnsIntent: false,
    })
    assert.doesNotMatch(prompt, /Department boundaries \(owner-locked\)/)
    assert.match(prompt, /Must-not-match examples/)
    assert.match(prompt, /Voice & identity/)
  })

  it("includes department playbook when LLM owns intent (opening-turn-llm)", () => {
    const prompt = buildHomBotPrompt({
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
      llmOwnsIntent: true,
    })
    assert.match(prompt, /Department boundaries \(owner-locked\)/)
    assert.match(prompt, /Think want, not words/)
    assert.ok(homBotDepartmentPlaybookBytes() > 5000)
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
      llmOwnsIntent: true,
    })
    assert.match(prompt, /Department boundaries \(owner-locked\)/)
  })

  it("omits reference section on lightweight structured turns", () => {
    const prompt = buildHomBotPrompt({
      userText: "שלום",
      history: [{ role: "user", content: "שלום" }],
      llmOwnsIntent: false,
    })
    assert.doesNotMatch(prompt, /Think want, not words/)
    assert.ok(homBotReferenceSectionBytes() > 1000)
  })
})
