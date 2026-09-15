import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  shouldReleaseStructuredDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import { classifyPostPurchaseCase } from "@/lib/agents/inquiry-intent"
import { requiresOrderIdentification } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { runStructuredDocumentPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

/** Replay 532219451 / 0526052903 — partial delivery; receipt mention must not hijack document pre-turn. */
describe("missing item releases document structured flow (532219451)", () => {
  const opening =
    "היי\nביצעתי הזמנה של שני שטיחים וקיבלתי קבלה עבור שני שטיחים\nבפועל הגיע רק שטיח 1 וגם החשבונית מס הייתה רק על 1\nחסר שטיח"

  it("classifies as missing item, not document copy", () => {
    assert.equal(classifyPostPurchaseCase(opening), "missing_item")
    assert.equal(shouldReleaseStructuredDocumentFlow([], opening), true)
    assert.equal(isDigitalDocumentRequest(opening), false)
  })

  it("skips document pre-turn so the LLM handles service intake", async () => {
    assert.equal(isActiveDigitalDocumentFlow([], opening), false)
    assert.equal(requiresOrderIdentification(opening, []), true)

    const preTurn = await runStructuredDocumentPreTurn({
      turn: { text: opening, media: [] },
      history: [],
      phone: "+972526052903",
    })
    assert.equal(preTurn.kind, "skip")
  })

  it("adds missing-item hint instead of document copy hint", () => {
    const hints = buildConversationHints({
      history: [],
      body: opening,
      whatsappPhone: "+972526052903",
    })

    assert.ok(hints)
    assert.match(hints, /MISSING ITEM/i)
    assert.doesNotMatch(hints, /DOCUMENT COPY \(קבלה/)
    assert.doesNotMatch(hints, /fetch_digital_document only/)
  })

  it("still continues structured document flow after bot opened intake", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אפשר לשלוח חשבונית מס?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם העסקה רשומה על המספר ממנו אני מתכתב כרגע? (052-6052903)",
      },
    ]

    assert.equal(isActiveDigitalDocumentFlow(history, "כן"), true)
  })
})
