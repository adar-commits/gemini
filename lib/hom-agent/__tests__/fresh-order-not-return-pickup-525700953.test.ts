import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  isFreshOrderLookupTurn,
  isReturnPickupAwaitingThread,
} from "@/lib/agents/service-intake"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"

/** Replay 525700953 — stale return thread must not hijack fresh order # opening. */
describe("fresh order lookup not return pickup (525700953)", () => {
  const staleReturnHistory: HistoryMessage[] = [
    {
      role: "user",
      content: "אני ממתין כבר שבועיים שיאספו ממני שטיח שרציתי להחזיר",
    },
    {
      role: "assistant",
      content: "מה מספר ההזמנה או שאבדוק לפי הטלפון?",
    },
  ]

  const opening = "אשמח לברר לגבי הזמנה מס הזמנה #78645"

  it("detects fresh order reference on this turn", () => {
    assert.equal(isFreshOrderLookupTurn(opening), true)
  })

  it("does not bind stale return pickup when customer names order #", () => {
    assert.equal(
      isReturnPickupAwaitingThread(staleReturnHistory, opening),
      false
    )
  })

  it("starts order lookup pre-turn, not return pickup summary", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: opening, media: [] },
      history: staleReturnHistory,
      phone: "+972501234567",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.doesNotMatch(result.reply, /בקשת החזרה/)
    assert.doesNotMatch(result.reply, /נוצרה בקשת איסוף/)
    assert.match(result.reply, /(?:האם|מספר|טלפון|הזמנה)/i)
  })
})
