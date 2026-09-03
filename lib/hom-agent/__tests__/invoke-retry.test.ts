import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  beginTurnMetrics,
  finishTurnMetrics,
  recordLlmCall,
  recordTurnTokens,
  setRoutingPath,
} from "@/lib/agent-core/turn-metrics"
import {
  bindPriorityApiBeforeCall,
  resetPriorityApiTurnState,
  wasPriorityApiPreMessageSentThisTurn,
} from "@/lib/agents/priority-webhook"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { shouldRetryInvokeAfterFailure } from "@/lib/hom-agent/invoke-retry"

const SAPIR_SHIPPING =
  "שלום אשמח לדעת מה קורה עם המשלוח.. נראה שעוד לא יצא להפצה"
const DELAY_FOLLOWUP = "למה יש עיכוב עם המשלוח"

describe("shipping status detection", () => {
  it("matches delivery delay phrasing from production thread", () => {
    assert.equal(isShippingStatusQuestion(SAPIR_SHIPPING), true)
    assert.equal(isShippingStatusQuestion(DELAY_FOLLOWUP), true)
  })
})

describe("invoke retry guard", () => {
  const conversationId = "retry-test-conv"

  it("allows one retry on clean invoke failure", () => {
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), true)
    finishTurnMetrics(conversationId)
  })

  it("allows retry for policy FAQ turns too", () => {
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), true)
    finishTurnMetrics(conversationId)
  })

  it("blocks retry after any LLM progress", () => {
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    recordLlmCall(conversationId, "anthropic/claude-sonnet-4.6")
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), false)
    finishTurnMetrics(conversationId)
  })

  it("blocks retry after Priority wait bubble was sent", async () => {
    const previousDelay = process.env.PRIORITY_PREMESSAGE_DELAY_MS
    process.env.PRIORITY_PREMESSAGE_DELAY_MS = "10"
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    bindPriorityApiBeforeCall(async () => {})
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return new Response("null", { status: 500 })
    }
    try {
      const { bindPriorityApiEnabled, callPriorityWebhook } = await import(
        "@/lib/agents/priority-webhook"
      )
      bindPriorityApiEnabled(true)
      const pending = callPriorityWebhook({ actionType: "getOrders", value: "0501234567" })
      await new Promise((resolve) => setTimeout(resolve, 20))
      await pending
    } finally {
      globalThis.fetch = originalFetch
      if (previousDelay === undefined) delete process.env.PRIORITY_PREMESSAGE_DELAY_MS
      else process.env.PRIORITY_PREMESSAGE_DELAY_MS = previousDelay
    }
    assert.equal(wasPriorityApiPreMessageSentThisTurn(), true)
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), false)
    finishTurnMetrics(conversationId)
  })

  it("blocks retry after tool routing path was set", () => {
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    setRoutingPath(conversationId, "v3_tools")
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), false)
    finishTurnMetrics(conversationId)
  })

  it("blocks retry after token usage was recorded", () => {
    beginTurnMetrics(conversationId, "balanced")
    resetPriorityApiTurnState()
    recordTurnTokens(conversationId, 120, 5)
    assert.equal(shouldRetryInvokeAfterFailure(conversationId), false)
    finishTurnMetrics(conversationId)
  })
})
