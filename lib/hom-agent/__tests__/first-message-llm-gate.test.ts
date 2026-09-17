import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  hasStructuredPendingStateBinding,
  isOpeningTurnLlmOnlyEnabled,
  shouldDeferStructuredPreTurnToLlm,
} from "@/lib/hom-agent/opening-turn-llm"
import {
  runStructuredExchangeExecutionPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const ENV_KEY = "HOM_OPENING_TURN_LLM_ONLY"

afterEach(() => {
  delete process.env[ENV_KEY]
})

/** LLM-first routing — structured shortcuts only on pending binding state. */
describe("LLM-first structured gate", () => {
  it("is enabled by default", () => {
    delete process.env[ENV_KEY]
    assert.equal(isOpeningTurnLlmOnlyEnabled(), true)
  })

  it("can be disabled via HOM_OPENING_TURN_LLM_ONLY=0", () => {
    process.env[ENV_KEY] = "0"
    assert.equal(isOpeningTurnLlmOnlyEnabled(), false)
    assert.equal(
      shouldDeferStructuredPreTurnToLlm([], { text: "שלום", media: [] }),
      false
    )
  })

  it("defers structured pre-turn on empty history when enabled", () => {
    assert.equal(
      shouldDeferStructuredPreTurnToLlm([], { text: "מה מדיניות ההחזרה?", media: [] }),
      true
    )
  })

  it("defers follow-up turns without pending binding state", () => {
    const history = [
      { role: "user" as const, content: "מה מדיניות ההחזרה?" },
      {
        role: "assistant" as const,
        content: "*הום בוט :)*\nמדיניות ההחזרה...",
      },
    ]
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, {
        text: "אשמח לעבור לנציג מכירות",
        media: [],
      }),
      true
    )
  })

  it("allows structured binding during phone lookup confirm", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "מתי יגיע?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע?",
      },
    ]
    const turn = { text: "כן", media: [] as [] }
    assert.equal(hasStructuredPendingStateBinding(history, turn, "כן"), true)
    assert.equal(shouldDeferStructuredPreTurnToLlm(history, turn), false)
  })

  it("KB FAQ handler would match but gate blocks run-turn use", () => {
    const message = "מה מדיניות ההחזרה?"
    const history: [] = []
    const structured = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: message, media: [] },
      history,
    })
    assert.equal(structured.kind, "handled")
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, { text: message, media: [] }),
      true
    )
  })

  it("exchange handler would match but gate blocks run-turn use", () => {
    const message = "קיבלתי את השטיח ואני רוצה להחליף למידה 200*300"
    const history: [] = []
    const structured = runStructuredExchangeExecutionPreTurn({
      turn: { text: message, media: [] },
      history,
    })
    assert.equal(structured.kind, "handled")
    assert.equal(
      shouldDeferStructuredPreTurnToLlm(history, { text: message, media: [] }),
      true
    )
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
