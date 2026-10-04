import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isServicePhotoAnalysisContext,
  isWrongItemDeliveryPhotoTurn,
} from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING_BODY =
  "זה השטיח שהזמנתי והראיתי למוכר אנדריי בדיוק [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533407659/HM5WAA72QB2XP32G9XRXI8QL0YH3USAT.jpg]"

const BAD_REPLY =
  "תודה, קיבלתי את התמונה — אעביר ליועץ העיצוב. לאיזה חלל מיועד השטיח? סלון, חדר שינה, או כל חלל אחר"

/** Replay 533657825 — wrong-item opening photo must not pivot to sales room question. */
describe("wrong item opening photo (533657825)", () => {
  it("detects ordered-at-store proof photo as wrong-item delivery", () => {
    assert.equal(isWrongItemDeliveryPhotoTurn(OPENING_BODY), true)
    assert.equal(isServicePhotoAnalysisContext([], OPENING_BODY), true)
  })

  it("emits service binding hint on opening photo turn", () => {
    const history: HistoryMessage[] = []
    const hints = buildConversationHints({ history, body: OPENING_BODY }) ?? ""
    assert.match(hints, /533657825/)
    assert.match(hints, /WRONG-ITEM DELIVERY PHOTO/)
    assert.match(hints, /SERVICE PHOTO VISION/)
    assert.doesNotMatch(hints, /PHOTO RECEIVED \(533695023/)
    assert.doesNotMatch(hints, /SALES ROOM PHOTO/)
  })

  it("the bad reply pivoted to sales room intake", () => {
    assert.match(BAD_REPLY, /לאיזה חלל/)
    assert.match(BAD_REPLY, /יועץ העיצוב/)
  })
})
