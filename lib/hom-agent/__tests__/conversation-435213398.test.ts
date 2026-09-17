import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { buildLlmFailureReply } from "@/lib/agent-core/fallbacks"
import {
  isHumanHandoffOfferPending,
  isHumanHandoffPending,
  resolveLlmUnavailableHandoff,
} from "@/lib/agents/off-topic"
import { runPreTurnGuards, runStructuredExchangeExecutionPreTurn } from "@/lib/hom-agent/pre-turn"
import { shouldDeferStructuredPreTurnToLlm } from "@/lib/hom-agent/opening-turn-llm"
import type { HistoryMessage } from "@/lib/agents/types"

const ENV_KEY = "HOM_OPENING_TURN_LLM_ONLY"

afterEach(() => {
  delete process.env[ENV_KEY]
})

/** Replay 435213398 / +972524727511 — exchange hijack + gateway handoff loop. */
describe("conversation 435213398 regression", () => {
  const afterColorMismatch: HistoryMessage[] = [
    { role: "user", content: "שלום" },
    { role: "assistant", content: "*הום בוט :)*\nהיי! 😊 במה אוכל לעזור?" },
    {
      role: "user",
      content: "קיבלתי שטיח שהזמנתי אבל הצבע ממש לא תואם לתמונות באתר",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\n… החלפה / החזרה … איך תרצו להמשיך?",
    },
  ]

  it("defers structured shortcuts on sales rep request after dissatisfaction menu", () => {
    process.env[ENV_KEY] = "1"
    const turn = { text: "אשמח לעבור לנציג מכירות", media: [] as [] }
    assert.equal(shouldDeferStructuredPreTurnToLlm(afterColorMismatch, turn), true)
    const structured = runStructuredExchangeExecutionPreTurn({
      turn,
      history: afterColorMismatch,
    })
    assert.equal(structured.kind, "skip")
  })

  it("gateway budget failure offer binds as pending handoff", () => {
    const failureReply = buildLlmFailureReply({ gatewayBudgetExceeded: true })
    const history: HistoryMessage[] = [
      ...afterColorMismatch,
      {
        role: "user",
        content: "אשמח לעבור לנציג מכירות",
      },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה! נמשיך עם החלפה\nקודם נאתר את ההזמנה…",
      },
      { role: "user", content: "IN264019938" },
      { role: "assistant", content: failureReply },
    ]
    assert.equal(isHumanHandoffPending(history), true)
    assert.equal(isHumanHandoffOfferPending(history), true)
    assert.equal(resolveLlmUnavailableHandoff("כן", history), "human_service")
  })

  it("pre-turn assigns human_service on כן after gateway failure without LLM", () => {
    const failureReply = buildLlmFailureReply({ gatewayBudgetExceeded: true })
    const history: HistoryMessage[] = [
      { role: "user", content: "IN264019938" },
      { role: "assistant", content: failureReply },
    ]
    const result = runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /העברתי/)
  })
})
