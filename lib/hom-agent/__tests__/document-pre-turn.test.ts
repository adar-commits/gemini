import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isActiveDigitalDocumentFlow } from "@/lib/agents/digital-document-flow"
import { requiresOrderIdentification } from "@/lib/agents/order-lookup"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import {
  runStructuredDocumentPreTurn,
  runStructuredOrderLookupPreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

describe("document flow pre-turn (529869497)", () => {
  const opening = "אני צריך בבקשה העתק של חשבונית מס"
  const phoneConfirmReply = `*הום בוט :)*
האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (054-7495083)
אם לא, אשמח לקבל את המספר הנכון.`

  const historyAfterConfirm: HistoryMessage[] = [
    { role: "user", content: opening },
    { role: "assistant", content: phoneConfirmReply },
  ]

  it("treats invoice copy as document intent hint, not cold structured pre-turn", () => {
    assert.equal(isActiveDigitalDocumentFlow([], opening), false)
    assert.equal(requiresOrderIdentification(opening, []), false)
    assert.equal(
      requiresOrderIdentification("לא, זה על המספר הזה: 0533402101", historyAfterConfirm),
      false
    )
  })

  it("document pre-turn handles alternate phone with getDocument path", async () => {
    const result = await runStructuredDocumentPreTurn({
      turn: { text: "לא, זה על המספר הזה: 0533402101", media: [] },
      history: historyAfterConfirm,
      phone: "+972547495083",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /מסמך|חשבונית|קישור/i)
    assert.doesNotMatch(result.reply, /הזמנות פעילות/)
  })

  it("order pre-turn skips when document flow owns the thread", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "לא, זה על המספר הזה: 0533402101", media: [] },
      history: historyAfterConfirm,
      phone: "+972547495083",
    })
    assert.equal(result.kind, "skip")
  })

  it("lookup_order_status tool refuses during document flow", async () => {
    const result = await executeLookupOrderStatus({
      body: "לא, זה על המספר הזה: 0533402101",
      phone: "+972547495083",
      history: historyAfterConfirm,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match((result as { error: string }).error, /fetch_digital_document/)
  })

  it("opening invoice request skips structured pre-turn for the LLM", async () => {
    const result = await runStructuredDocumentPreTurn({
      turn: { text: opening, media: [] },
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.kind, "skip")
  })

  it("document pre-turn continues only after bot opened document intake", () => {
    assert.equal(isActiveDigitalDocumentFlow(historyAfterConfirm, "כן"), true)
  })
})
