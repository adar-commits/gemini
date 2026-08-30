import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  buildOrderStatusClarificationReply,
  isOrderStatusClarificationQuestion,
} from "@/lib/agents/order-lookup"

describe("order status clarification", () => {
  const statusHistory: HistoryMessage[] = [
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, השטיח נארז במחסני החברה וממתין לאיסוף של חברת השליחויות נכון לתאריך 30.8.2026",
    },
  ]

  it("detects what-does-it-mean follow-ups", () => {
    assert.equal(isOrderStatusClarificationQuestion("מה זה אומר?"), true)
    assert.equal(isOrderStatusClarificationQuestion("לא הבנתי"), true)
    assert.equal(isOrderStatusClarificationQuestion("איפוס"), false)
  })

  it("explains packed-awaiting-courier status and offers service handoff", () => {
    const reply = buildOrderStatusClarificationReply(statusHistory)
    assert.match(reply, /בקצרה/)
    assert.match(reply, /חברת השליחויות/)
    assert.match(reply, /האם להעביר לנציג שירות/)
  })
})
