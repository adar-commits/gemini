import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isFirstSubstantiveCustomerTurn } from "@/lib/agents/greeting"
import {
  runStructuredExchangeExecutionPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/pre-turn"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

/** Opening turns must reach invokeHomAgent — structured handlers may match but run-turn skips them. */
describe("first message LLM gate", () => {
  it("defers structured pre-turn on empty history", () => {
    assert.equal(isFirstSubstantiveCustomerTurn([]), true)
    assert.equal(shouldDeferStructuredPreTurnToLlm([]), true)
  })

  it("does not defer once the customer has prior substantive turns", () => {
    const history = [
      { role: "user" as const, content: "מה מדיניות ההחזרה?" },
      {
        role: "assistant" as const,
        content: "*הום בוט :)*\nמדיניות ההחזרה...",
      },
    ]
    assert.equal(shouldDeferStructuredPreTurnToLlm(history), false)
  })

  it("KB FAQ handler would match opener but gate blocks run-turn use", () => {
    const message = "מה מדיניות ההחזרה?"
    const history: [] = []
    const structured = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: message, media: [] },
      history,
    })
    assert.equal(structured.kind, "handled")
    assert.equal(shouldDeferStructuredPreTurnToLlm(history), true)
  })

  it("exchange handler would match opener but gate blocks run-turn use", () => {
    const message = "קיבלתי את השטיח ואני רוצה להחליף למידה 200*300"
    const history: [] = []
    const structured = runStructuredExchangeExecutionPreTurn({
      turn: { text: message, media: [] },
      history,
    })
    assert.equal(structured.kind, "handled")
    assert.equal(shouldDeferStructuredPreTurnToLlm(history), true)
  })

  it("emits first-message LLM hint on opening turn", () => {
    const hints = buildConversationHints({
      body: "מה מדיניות ההחזרה?",
      history: [],
    })
    assert.match(hints ?? "", /FIRST CUSTOMER MESSAGE/i)
    assert.match(hints ?? "", /LLM \+ tools/i)
  })
})
