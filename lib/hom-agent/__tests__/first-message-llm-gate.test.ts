import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { isFirstSubstantiveCustomerTurn } from "@/lib/agents/greeting"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  isOpeningTurnLlmOnlyEnabled,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/opening-turn-llm"
import {
  runStructuredExchangeExecutionPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
} from "@/lib/hom-agent/pre-turn"

const ENV_KEY = "HOM_OPENING_TURN_LLM_ONLY"

afterEach(() => {
  delete process.env[ENV_KEY]
})

/** Opening turns must reach invokeHomAgent when the flag is on. */
describe("first message LLM gate", () => {
  it("is enabled by default", () => {
    delete process.env[ENV_KEY]
    assert.equal(isOpeningTurnLlmOnlyEnabled(), true)
  })

  it("can be disabled via HOM_OPENING_TURN_LLM_ONLY=0", () => {
    process.env[ENV_KEY] = "0"
    assert.equal(isOpeningTurnLlmOnlyEnabled(), false)
    assert.equal(shouldDeferStructuredPreTurnToLlm([]), false)
  })

  it("defers structured pre-turn on empty history when enabled", () => {
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
