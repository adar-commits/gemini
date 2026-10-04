import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPureHandoffAffirmation } from "@/lib/agents/compound-reply"
import {
  buildOrderNumberNotFoundReply,
  shouldBindKnownOrderTurn,
} from "@/lib/agents/order-lookup"
import {
  isHumanHandoffOfferPending,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { PRIORITY_API_PREMESSAGE } from "@/lib/agents/priority-webhook"
import { runPreTurnGuards } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 290863548 — exchange, IN not found, handoff offer, wait bubble after offer. */
describe("exchange handoff confirm after wait bubble (290863548)", () => {
  const historyBeforeConfirm: HistoryMessage[] = [
    { role: "user", content: "הי" },
    { role: "assistant", content: "*הום בוט :)* היי חן! 😊 במה אפשר לעזור?" },
    { role: "user", content: "החלפה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* נמשיך עם החלפה כדי לאתר את ההזמנה, יש מספר הזמנה? (למשל #36805) אם אין, אפשר לאתר לפי מספר הטלפון שממנו מתכתבים.",
    },
    { role: "user", content: "IN264020375" },
    {
      role: "assistant",
      content: buildOrderNumberNotFoundReply("IN264020375"),
    },
    { role: "assistant", content: PRIORITY_API_PREMESSAGE },
  ]

  const body = "כן תודה"

  it("treats כן תודה as handoff affirmation", () => {
    assert.equal(isPureHandoffAffirmation(body), true)
  })

  it("detects handoff offer even when wait bubble is last", () => {
    assert.equal(isHumanHandoffOfferPending(historyBeforeConfirm), true)
    assert.equal(isHumanHandoffPending(historyBeforeConfirm), true)
  })

  it("pre-turn binds כן תודה to human_service — not alternate phone", () => {
    const result = runPreTurnGuards({
      turn: { text: body, media: [] },
      history: historyBeforeConfirm,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /מה מספר הטלפון/)
  })

  it("does not bind known-order lookup while handoff offer is open", () => {
    assert.equal(shouldBindKnownOrderTurn(body, historyBeforeConfirm), false)
  })
})
