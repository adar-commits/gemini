import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/**
 * 533695023 — customer asked "יש לכם את השטיח הזה ב230/160?" with a photo. FAQ agent replied
 * "נראה שהתמונה או הקישור של השטיח לא הגיעו אליי" and asked for a link / מק״ט.
 */
describe("customer photo counts as received on first turn 533695023", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "היי, האם יש לכם את השטיח הזה ב230/160?" },
  ]
  const body =
    "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533444818/OPSG47PNBHVTBK6ZD2LUEUF5OY7TX4ZO.jpg]"

  it("tells the model the photo arrived and to hand off to sales", () => {
    const hints = buildConversationHints({ history, body, whatsappPhone: "+972500000000" })
    assert.notEqual(hints, null)
    assert.match(hints!, /PHOTO RECEIVED \(533695023\)/)
    assert.match(hints!, /already arrived/)
    assert.match(hints!, /never ask them to resend/)
    assert.match(hints!, /action: human_sales/)
  })

  it("no photo hint on a text-only turn", () => {
    const hints = buildConversationHints({
      history,
      body: "היי, האם יש לכם את השטיח הזה ב230/160?",
      whatsappPhone: "+972500000000",
    })
    assert.doesNotMatch(hints ?? "", /PHOTO RECEIVED/)
  })
})
