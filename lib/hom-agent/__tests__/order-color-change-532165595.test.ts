import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING: HistoryMessage[] = [
  { role: "user", content: "היי" },
  {
    role: "assistant",
    content: "*הום בוט :)*\nהיי! 😊 שמח שפנית — במה אוכל לעזור היום?",
  },
]

const COLOR_CHANGE = "אני אשמח לשנות את הצבע של השטיח שהזמנתי"

/** Replay 532165595 / 0533353836 — classic order color change must not hit never-stuck. */
describe("order color change (532165595)", () => {
  it("lookup_order_status returns phone confirm when LLM calls the tool", async () => {
    const result = await executeLookupOrderStatus({
      body: COLOR_CHANGE,
      history: OPENING,
      phone: "+972533353836",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.doesNotMatch(result.reply, /לא הצלחתי להבין/)
    assert.match(result.reply, /053-3353836|רשומה על המספר/)
  })

  it("hints exchange path after order modification ask", () => {
    const hints = buildConversationHints({
      body: COLOR_CHANGE,
      history: OPENING,
      phone: "0533353836",
    })
    assert.match(hints ?? "", /lookup_order_status|exchange|החלפה/i)
  })
})
