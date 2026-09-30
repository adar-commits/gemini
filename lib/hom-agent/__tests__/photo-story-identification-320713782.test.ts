import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

/**
 * 320713782 — customer sent a story screenshot asking how the rug is named on the site.
 * Bot wrote "אני מעביר אליו" but action stayed reply instead of human_sales.
 */
describe("story photo rug name identification 320713782", () => {
  const history: HistoryMessage[] = []
  const body =
    "היי איך השטיח נקרא באתר? [תמונה: היי איך השטיח נקרא באתר?][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/320633497/AD7Z91RBX030THEZJ949FD3L4A5N65U2.jpg]"

  it("binds photo identification to human_sales in the same JSON", () => {
    const hints = buildConversationHints({ history, body, whatsappPhone: "+972500000000" })
    assert.notEqual(hints, null)
    assert.match(hints!, /PHOTO RECEIVED \(533695023 \/ 320713782\)/)
    assert.match(hints!, /320713782|איך השטיח נקרא/)
    assert.match(hints!, /action: human_sales/)
    assert.match(hints!, /crm_department: sales/)
    assert.match(hints!, /never write מעביר/)
    assert.match(hints!, /Action ↔ transfer wording/)
  })
})
