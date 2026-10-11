import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOrderNumberRequestPending } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const ORDER_ASK =
  "*הום בוט :)* מבין שאת מחכה לשטיח כבר הרבה זמן. כדי לאתר את ההזמנה הנכונה, יש לך מספר הזמנה? (למשל #76884 או SO26005938) אם ההזמנה נרשמה על מספר טלפון אחר, אפשר לשלוח לי אותו ואחפש לפיו."

const INACTIVITY_PING = "*הום בוט :)* Gal Sapir, עדיין כאן?"

/** Replay 375364836 — כן after ping must not reset to generic help while order # is pending. */
describe("order lookup inactivity ping 375364836", () => {
  function historyThroughPing(): HistoryMessage[] {
    return [
      { role: "user", content: "לא" },
      { role: "assistant", content: ORDER_ASK },
      { role: "assistant", content: INACTIVITY_PING },
    ]
  }

  it("detects order-number ask as pending before the ping", () => {
    assert.equal(isOrderNumberRequestPending(historyThroughPing()), true)
  })

  it("hints bind inactivity affirmation to order lookup, not still-here ack", () => {
    const hints =
      buildConversationHints({ body: "כן", history: historyThroughPing() }) ?? ""
    assert.match(hints, /INACTIVITY PING BINDING/)
    assert.match(hints, /375364836/)
    assert.doesNotMatch(hints, /INACTIVITY STILL-HERE ACK/)
  })

  it("pre-turn does not hardcode generic still-here ack", async () => {
    const result = await runPreTurnGuards({
      turn: { text: "כן", media: [] },
      history: historyThroughPing(),
      customerName: "Gal Sapir",
    })
    assert.notEqual(result.kind, "handled")
    if (result.kind === "handled") {
      assert.doesNotMatch(result.reply ?? "", /איך אוכל להמשיך לעזור/)
    }
  })
})
