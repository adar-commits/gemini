import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isWrongItemDeliveryPhotoTurn } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי מה קורה ? שלחתם לנו טעות בהזמנה האדום לא תואם לכורסאות זה לא מה שהזמנו\nתוכלו להחליף לנו בבקשה\n[media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/508054404/DLNDPO5P8J90MU3UIH8OV6LBT1SOZFHA.jpg]"

const SERVICE_ASK =
  "*הום בוט :)*\nהיי טליה, מצטער שזה מה שהגיע. קיבלתי את התמונה — רואה את הפוף על הכורסה. כדי שנציג השירות יוכל לטפל בהחלפה: איזה צבע הזמנתם במקור, ומדובר בהזמנה של הפופים מ-8.9 (SO26021723)?"

/** Replay 508272038 — wrong-order replacement must stay service, not human_sales. */
describe("wrong order replacement handoff 508272038", () => {
  it("detects order-mismatch opening photo as wrong-item delivery", () => {
    assert.equal(isWrongItemDeliveryPhotoTurn(OPENING), true)
  })

  it("opening photo hint binds service not generic PHOTO RECEIVED sales handoff", () => {
    const hints = buildConversationHints({ history: [], body: OPENING }) ?? ""
    assert.match(hints, /508272038|WRONG-ITEM DELIVERY PHOTO/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
  })

  it("after service replacement intake started, handoff hint forbids human_sales", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: OPENING },
      { role: "assistant", content: SERVICE_ASK },
      { role: "user", content: "כן" },
      { role: "user", content: "הזמנו פסים כמו הכורסאות" },
    ]
    const body = "תוכלו להחליף לנו למה שהזמנו במקור"
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /WRONG ORDER ITEM REPLACEMENT \(508272038\)/)
    assert.match(hints, /human_service/)
    assert.doesNotMatch(hints, /ORDER MODIFICATION/)
  })
})
