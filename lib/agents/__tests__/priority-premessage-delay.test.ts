import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  bindPriorityApiBeforeCall,
  bindPriorityApiEnabled,
  callPriorityWebhook,
  resetPriorityApiTurnState,
  wasPriorityApiPreMessageSentThisTurn,
} from "@/lib/agents/priority-webhook"

describe("priority api delayed pre-message", () => {
  it("skips wait bubble when lookup finishes before delay", async () => {
    const previousDelay = process.env.PRIORITY_PREMESSAGE_DELAY_MS
    process.env.PRIORITY_PREMESSAGE_DELAY_MS = "2500"
    resetPriorityApiTurnState()
    bindPriorityApiEnabled(true)
    let sent = false
    bindPriorityApiBeforeCall(async () => {
      sent = true
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response("{}", { status: 200 })
    try {
      await callPriorityWebhook({ actionType: "getOrders", value: "0501234567" })
      assert.equal(sent, false)
      assert.equal(wasPriorityApiPreMessageSentThisTurn(), false)
    } finally {
      globalThis.fetch = originalFetch
      if (previousDelay === undefined) delete process.env.PRIORITY_PREMESSAGE_DELAY_MS
      else process.env.PRIORITY_PREMESSAGE_DELAY_MS = previousDelay
      resetPriorityApiTurnState()
    }
  })
})
